import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

// OpenRouter client — used when OPENROUTER_API_KEY is set
const openrouter =
  process.env.OPENROUTER_API_KEY
    ? new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultHeaders: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://aura.so",
          "X-Title": "Aura",
        },
      })
    : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Fallback LLM for when no running OpenClaw instance exists
function getFallbackLLM(): { client: OpenAI; model: string } | null {
  if (openrouter) {
    return { client: openrouter, model: "anthropic/claude-sonnet-4.5" };
  }
  if (openai) {
    return { client: openai, model: "gpt-4.1-mini" };
  }
  return null;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. You help users manage their work and life.

Keep responses concise but helpful. You're chatting in real-time, so don't write essays.
Format responses with markdown when helpful (bold, lists, etc.)`;

/**
 * Build a system prompt from the agent's configured name and personality.
 * Falls back to a generic prompt if no agent is found.
 */
function buildSystemPrompt(agentName?: string, agentPersonality?: string | null): string {
  if (!agentName) return DEFAULT_SYSTEM_PROMPT;

  const personality = agentPersonality
    ? `\n\n${agentPersonality}`
    : "\n\nBe helpful, concise, and friendly. Ask clarifying questions when needed.";

  return `Your name is ${agentName}.${personality}

Keep responses concise but helpful. You're chatting in real-time, so don't write essays.
Format responses with markdown when helpful (bold, lists, etc.)`;
}

// ---------- SSE helpers ----------

function sseContent(token: string): string {
  return `data: ${JSON.stringify({ content: token })}\n\n`;
}

function sseError(msg: string): string {
  return `data: ${JSON.stringify({ error: msg })}\n\n`;
}

function sseDone(): string {
  return "data: [DONE]\n\n";
}

// ---------- OpenClaw instance lookup ----------

interface OpenClawInstance {
  serverIp: string;
  gatewayToken: string;
  agentName: string;
  agentPersonality: string | null;
}

/**
 * Find the user's running OpenClaw instance (most recently updated agent).
 * Returns the server IP, gateway auth token, and agent identity for proxying.
 */
async function getUserOpenClawInstance(userId: string, agentId?: string): Promise<OpenClawInstance | null> {
  const whereClause = agentId
    ? and(eq(agents.id, agentId), eq(agents.userId, userId))
    : eq(agents.userId, userId);

  const userAgents = await db.query.agents.findMany({
    where: whereClause,
    orderBy: [desc(agents.updatedAt)],
    with: {
      instances: true,
    },
  });

  for (const agent of userAgents) {
    const runningInstance = (agent.instances ?? []).find(
      (inst) => inst.status === "running" && inst.serverIp
    );

    if (runningInstance) {
      const config = (agent.config as Record<string, unknown>) ?? {};
      const gatewayToken = config.gatewayToken as string | undefined;

      if (gatewayToken && runningInstance.serverIp) {
        return {
          serverIp: runningInstance.serverIp,
          gatewayToken,
          agentName: agent.name,
          agentPersonality: agent.personality,
        };
      }
    }
  }

  return null;
}

// ---------- Stream from OpenClaw Gateway ----------
// OpenClaw handles Google Workspace tools natively via the google-workspace
// skill installed on the VM.  We only need to stream the response; tool
// execution (email/calendar) happens server-side on the VM.

async function streamFromOpenClaw(
  controller: ReadableStreamDefaultController,
  instance: OpenClawInstance,
  messages: { role: string; content: string }[],
): Promise<void> {
  const encoder = new TextEncoder();
  const url = `http://${instance.serverIp}/v1/chat/completions`;
  const systemPrompt = buildSystemPrompt(instance.agentName, instance.agentPersonality);

  const allMessages: Record<string, unknown>[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  // Single streaming call — OpenClaw handles tool execution internally
  const res = await fetch(url, {
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
    signal: AbortSignal.timeout(120_000), // longer timeout — OpenClaw may run tools
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenClaw gateway error (${res.status}): ${text}`);
  }

  if (!res.body) throw new Error("OpenClaw gateway returned no body");

  // Read the SSE stream from OpenClaw and forward content deltas
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasContent = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") continue;

      try {
        const chunk = JSON.parse(payload);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          hasContent = true;
          controller.enqueue(encoder.encode(sseContent(delta)));
        }
      } catch {
        // Skip malformed SSE lines
      }
    }
  }

  if (!hasContent) {
    controller.enqueue(encoder.encode(sseContent("I'm sorry, I couldn't process that request.")));
  }
}

// ---------- Stream from fallback LLM (no Google tools) ----------

async function streamFromFallbackLLM(
  controller: ReadableStreamDefaultController,
  llm: { client: OpenAI; model: string },
  messages: { role: string; content: string }[],
  agentName: string | undefined,
  agentPersonality: string | null | undefined,
  userId?: string
): Promise<void> {
  const encoder = new TextEncoder();

  const basePrompt = buildSystemPrompt(agentName, agentPersonality);
  const systemPrompt = basePrompt +
    "\n\nWhen users ask you to perform actions (like send emails or schedule meetings), acknowledge the request and let them know their agent needs to be running to use these features. Suggest they start their agent from the dashboard.";

  const llmMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m: { role: string; content: string }) => ({
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
    ...(openrouter && userId ? { user: userId } : {}),
  });

  let hasContent = false;
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      hasContent = true;
      controller.enqueue(encoder.encode(sseContent(delta)));
    }
  }

  if (!hasContent) {
    controller.enqueue(encoder.encode(sseContent("I'm sorry, I couldn't process that request.")));
  }
}

// ---------- Main handler ----------

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  const { success } = await checkRateLimit(`chat:${ip}`);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  let body: { messages?: unknown; agentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, agentId } = body;
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json(
      { error: "Invalid messages format" },
      { status: 400 }
    );
  }

  const user = await getCurrentUser();

  // Look up running OpenClaw instance
  const instance = user
    ? await getUserOpenClawInstance(user.id, agentId)
    : null;

  // Look up agent identity for fallback prompt
  let agentName = instance?.agentName;
  let agentPersonality = instance?.agentPersonality;
  if (agentId && user && !instance) {
    const agentRecord = await db.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.userId, user.id)),
    });
    if (agentRecord) {
      agentName = agentRecord.name;
      agentPersonality = agentRecord.personality;
    }
  }

  console.log(`[Chat] agentId=${agentId}, hasInstance=${!!instance}`);

  // Build SSE response stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        // Path 1: Proxy to user's running OpenClaw instance
        // OpenClaw handles Google tools natively via the google-workspace skill
        if (instance) {
          try {
            await streamFromOpenClaw(controller, instance, messages);
            controller.enqueue(encoder.encode(sseDone()));
            controller.close();
            return;
          } catch (err) {
            console.error("[Chat] OpenClaw proxy failed, falling through to direct LLM:", err);
            // Fall through to direct LLM call
          }
        }

        // Path 2: Direct LLM call (no Google tools — agent must be running for that)
        const llm = getFallbackLLM();
        if (!llm) {
          const fallback = getFallbackResponse(messages);
          controller.enqueue(encoder.encode(sseContent(fallback)));
          controller.enqueue(encoder.encode(sseDone()));
          controller.close();
          return;
        }

        await streamFromFallbackLLM(
          controller,
          llm,
          messages,
          agentName,
          agentPersonality,
          user?.id
        );

        controller.enqueue(encoder.encode(sseDone()));
        controller.close();
      } catch (error) {
        console.error("Chat stream error:", error);
        try {
          controller.enqueue(
            encoder.encode(sseError("Something went wrong. Please try again."))
          );
          controller.enqueue(encoder.encode(sseDone()));
          controller.close();
        } catch {
          // Controller may already be closed
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

// Fallback responses when AI is not available
function getFallbackResponse(
  messages: { role: string; content: string }[]
): string {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    return "Hello! How can I help you today?";
  }

  const content = lastMessage.content.toLowerCase();

  if (
    content.includes("hello") ||
    content.includes("hi") ||
    content.includes("hey")
  ) {
    return "Hello! I can help you manage your emails, schedule meetings, update your CRM, and automate workflows. What can I help you with today?";
  }

  if (content.includes("email") || content.includes("inbox")) {
    return "I can help you manage your emails! Once connected, I can:\n\n- **Summarize** unread messages\n- **Draft** replies based on context\n- **Organize** your inbox by priority\n- **Flag** important messages\n\nWould you like to connect your email account in the Integrations section?";
  }

  if (
    content.includes("schedule") ||
    content.includes("meeting") ||
    content.includes("calendar")
  ) {
    return "I'd be happy to help with scheduling! With calendar access, I can:\n\n- **Check** your availability\n- **Suggest** optimal meeting times\n- **Book** appointments automatically\n- **Send** calendar invites\n\nHead to Integrations to connect your Google Calendar or Outlook.";
  }

  if (
    content.includes("task") ||
    content.includes("todo") ||
    content.includes("remind")
  ) {
    return "I can help you stay organized! I can:\n\n- **Create** reminders for important tasks\n- **Track** your todo list\n- **Prioritize** items by urgency\n- **Follow up** on deadlines\n\nJust tell me what you need to remember!";
  }

  if (content.includes("help") || content.includes("what can you do")) {
    return "Here's what I can help with:\n\n**Email** -- Summarize, draft, and organize\n**Calendar** -- Schedule meetings and manage events\n**CRM** -- Update contacts and track deals\n**Tasks** -- Create reminders and track todos\n**Research** -- Find information and summarize content\n**Communications** -- Draft messages for any platform\n\nConnect your tools in the Integrations section to unlock full capabilities!";
  }

  if (
    content.includes("crm") ||
    content.includes("sales") ||
    content.includes("deal") ||
    content.includes("contact")
  ) {
    return "I can help manage your CRM! With access to Salesforce, HubSpot, or your preferred CRM, I can:\n\n- **Update** contact information automatically\n- **Log** meeting notes and calls\n- **Track** deal progress\n- **Send** follow-up reminders\n\nConnect your CRM in the Integrations section to get started.";
  }

  return "I understand! Let me help you with that. Could you tell me a bit more about what you're looking to accomplish? I can assist with email, calendar, tasks, CRM updates, and more.";
}
