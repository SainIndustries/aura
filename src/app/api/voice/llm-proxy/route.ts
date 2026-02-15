import { NextRequest } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { agents, voiceSettings } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getFallbackLLM } from "@/lib/llm-client";

// ---------- OpenClaw instance lookup (reused from /api/chat) ----------

interface OpenClawInstance {
  serverIp: string;
  gatewayToken: string;
  agentName: string;
  agentPersonality: string | null;
}

async function getOpenClawInstance(agentId: string): Promise<OpenClawInstance | null> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    with: { instances: true },
  });

  if (!agent) return null;

  const runningInstance = (agent.instances ?? []).find(
    (inst) => inst.status === "running" && inst.serverIp
  );

  if (!runningInstance) return null;

  const config = (agent.config as Record<string, unknown>) ?? {};
  const gatewayToken = config.gatewayToken as string | undefined;

  if (!gatewayToken || !runningInstance.serverIp) return null;

  return {
    serverIp: runningInstance.serverIp,
    gatewayToken,
    agentName: agent.name,
    agentPersonality: agent.personality,
  };
}

// ---------- Helpers ----------

function buildSystemPrompt(agentName: string, agentPersonality: string | null): string {
  const personality = agentPersonality
    ? `\n\n${agentPersonality}`
    : "\n\nBe helpful, concise, and friendly. Ask clarifying questions when needed.";

  return `Your name is ${agentName}.${personality}

Keep responses concise — you're speaking out loud in a voice conversation, not writing an essay.
Do NOT use markdown formatting, bullet points, or special characters. Speak naturally as if talking to someone.`;
}

// ---------- POST handler ----------

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId");
  const token = url.searchParams.get("token");

  if (!agentId || !token) {
    return Response.json(
      { error: { message: "Missing agentId or token", type: "invalid_request_error" } },
      { status: 400 },
    );
  }

  // Validate token against stored llmProxyToken
  const voice = await db.query.voiceSettings.findFirst({
    where: and(
      eq(voiceSettings.agentId, agentId),
      eq(voiceSettings.llmProxyToken, token),
    ),
  });

  if (!voice) {
    return Response.json(
      { error: { message: "Invalid token", type: "authentication_error" } },
      { status: 401 },
    );
  }

  // Parse OpenAI-format request body
  let body: { messages?: { role: string; content: string }[]; model?: string; stream?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { message: "Invalid JSON", type: "invalid_request_error" } },
      { status: 400 },
    );
  }

  const messages = body.messages ?? [];
  const shouldStream = body.stream !== false;

  // Look up running OpenClaw instance
  const instance = await getOpenClawInstance(agentId);

  // Look up agent for personality/name (needed for fallback)
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });
  const agentName = instance?.agentName ?? agent?.name ?? "Assistant";
  const agentPersonality = instance?.agentPersonality ?? agent?.personality ?? null;

  console.log(`[LLM Proxy] agentId=${agentId}, hasInstance=${!!instance}, stream=${shouldStream}`);

  if (!shouldStream) {
    // Non-streaming response
    return handleNonStreaming(instance, agentName, agentPersonality, messages);
  }

  // Streaming response — passthrough OpenAI SSE format
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        if (instance) {
          try {
            await proxyToOpenClaw(controller, encoder, instance, agentName, agentPersonality, messages);
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          } catch (err) {
            console.error("[LLM Proxy] OpenClaw proxy failed, falling back:", err);
          }
        }

        // Fallback to direct LLM
        await proxyToFallbackLLM(controller, encoder, agentName, agentPersonality, messages);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("[LLM Proxy] Stream error:", error);
        try {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch {
          // Controller already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ---------- Proxy to OpenClaw ----------

async function proxyToOpenClaw(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  instance: OpenClawInstance,
  agentName: string,
  agentPersonality: string | null,
  messages: { role: string; content: string }[],
): Promise<void> {
  const systemPrompt = buildSystemPrompt(agentName, agentPersonality);
  const allMessages = [{ role: "system", content: systemPrompt }, ...messages];

  const res = await fetch(`http://${instance.serverIp}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${instance.gatewayToken}`,
    },
    body: JSON.stringify({
      model: "openclaw",
      messages: allMessages,
      stream: true,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenClaw gateway error (${res.status}): ${text}`);
  }

  if (!res.body) throw new Error("OpenClaw returned no body");

  // Passthrough — OpenClaw already outputs OpenAI SSE format
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        controller.enqueue(encoder.encode(line + "\n\n"));
      }
    }
  }
}

// ---------- Fallback LLM ----------

async function proxyToFallbackLLM(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  agentName: string,
  agentPersonality: string | null,
  messages: { role: string; content: string }[],
): Promise<void> {
  const llm = getFallbackLLM();
  if (!llm) {
    // No LLM configured — send a single content chunk
    const chunk = makeOpenAIChunk("I'm sorry, I'm having trouble connecting right now. Please try again later.");
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
    return;
  }

  const systemPrompt = buildSystemPrompt(agentName, agentPersonality) +
    "\n\nWhen users ask you to perform actions (like send emails or schedule meetings), acknowledge the request and let them know their agent needs to be running to use these features. Suggest they start their agent from the dashboard.";

  const llmMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const stream = await llm.client.chat.completions.create({
    model: llm.model,
    max_tokens: 1000,
    temperature: 0.7,
    messages: llmMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      const openaiChunk = makeOpenAIChunk(delta);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
    }
  }
}

// ---------- Non-streaming handler ----------

async function handleNonStreaming(
  instance: OpenClawInstance | null,
  agentName: string,
  agentPersonality: string | null,
  messages: { role: string; content: string }[],
): Promise<Response> {
  const systemPrompt = buildSystemPrompt(agentName, agentPersonality);
  const allMessages = [{ role: "system", content: systemPrompt }, ...messages];

  if (instance) {
    try {
      const res = await fetch(`http://${instance.serverIp}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${instance.gatewayToken}`,
        },
        body: JSON.stringify({
          model: "openclaw",
          messages: allMessages,
          stream: false,
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (res.ok) {
        const data = await res.json();
        return Response.json(data);
      }
    } catch (err) {
      console.error("[LLM Proxy] Non-streaming OpenClaw error:", err);
    }
  }

  // Fallback
  const llm = getFallbackLLM();
  if (!llm) {
    return Response.json({
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      choices: [{
        index: 0,
        message: { role: "assistant", content: "I'm sorry, I'm having trouble connecting right now." },
        finish_reason: "stop",
      }],
    });
  }

  const fallbackPrompt = systemPrompt +
    "\n\nWhen users ask you to perform actions (like send emails or schedule meetings), acknowledge the request and let them know their agent needs to be running to use these features.";

  const result = await llm.client.chat.completions.create({
    model: llm.model,
    max_tokens: 1000,
    temperature: 0.7,
    messages: [
      { role: "system", content: fallbackPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });

  return Response.json(result);
}

// ---------- Utils ----------

function makeOpenAIChunk(content: string) {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion.chunk",
    choices: [{
      index: 0,
      delta: { content },
      finish_reason: null,
    }],
  };
}
