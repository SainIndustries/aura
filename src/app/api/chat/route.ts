import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { agents, agentInstances, integrations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getValidAccessToken } from "@/lib/integrations/token-refresh";
import { GOOGLE_TOOLS, executeToolCall } from "@/lib/integrations/chat-tools";

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

const GOOGLE_TOOLS_PROMPT = `

You have access to the user's Gmail and Google Calendar. You can:
- List and read emails (use list_emails, read_email)
- Send emails (use send_email)
- List calendar events (use list_calendar_events)
- Create calendar events (use create_calendar_event)

Use these tools proactively when the user asks about emails, scheduling, or calendar.
When listing emails, summarize them concisely. When creating events or sending emails, confirm details with the user before executing.`;

// ---------- SSE helpers ----------

function sseContent(token: string): string {
  return `data: ${JSON.stringify({ content: token })}\n\n`;
}

function sseStatus(label: string): string {
  return `data: ${JSON.stringify({ status: label })}\n\n`;
}

function sseError(msg: string): string {
  return `data: ${JSON.stringify({ error: msg })}\n\n`;
}

function sseDone(): string {
  return "data: [DONE]\n\n";
}

const TOOL_STATUS_LABELS: Record<string, string> = {
  list_emails: "Checking your emails...",
  read_email: "Reading email...",
  send_email: "Sending email...",
  list_calendar_events: "Checking your calendar...",
  create_calendar_event: "Creating calendar event...",
};

function toolStatusLabel(toolName: string): string {
  return TOOL_STATUS_LABELS[toolName] || `Running ${toolName}...`;
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

// ---------- Google token lookup (for fallback mode) ----------

async function getUserGoogleToken(userId: string): Promise<string | null> {
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.userId, userId),
      eq(integrations.provider, "google")
    ),
  });

  if (!integration) return null;
  return getValidAccessToken(integration.id, "google");
}

// ---------- Stream from OpenClaw Gateway ----------

interface StreamOptions {
  tools?: typeof GOOGLE_TOOLS;
  googleAccessToken?: string;
}

type ToolCall = {
  id: string;
  type: string;
  function: { name: string; arguments: string };
};

async function streamFromOpenClaw(
  controller: ReadableStreamDefaultController,
  instance: OpenClawInstance,
  messages: { role: string; content: string }[],
  options?: StreamOptions
): Promise<void> {
  const encoder = new TextEncoder();
  const url = `http://${instance.serverIp}/v1/chat/completions`;
  const basePrompt = buildSystemPrompt(instance.agentName, instance.agentPersonality);
  const systemPrompt = options?.tools ? basePrompt + GOOGLE_TOOLS_PROMPT : basePrompt;

  const allMessages: Record<string, unknown>[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  // Tool-calling loop (non-streaming)
  if (options?.tools && options?.googleAccessToken) {
    let iterations = 0;
    while (iterations < 3) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${instance.gatewayToken}`,
        },
        body: JSON.stringify({
          model: "openclaw",
          messages: allMessages,
          tools: options.tools,
          stream: false,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`OpenClaw gateway error (${res.status}): ${text}`);
      if (!text) throw new Error("OpenClaw gateway returned empty response");

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`OpenClaw gateway returned invalid JSON: ${text.slice(0, 200)}`);
      }

      const choice = (data as { choices?: { message?: { content?: string; tool_calls?: ToolCall[] } }[] }).choices?.[0]?.message;
      if (!choice?.tool_calls?.length) break;

      allMessages.push(choice as Record<string, unknown>);

      for (const call of choice.tool_calls) {
        if (call.type !== "function") continue;
        controller.enqueue(encoder.encode(sseStatus(toolStatusLabel(call.function.name))));
        const result = await executeToolCall(
          call.function.name,
          JSON.parse(call.function.arguments),
          options.googleAccessToken!
        );
        allMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
      iterations++;
    }
  }

  // Final streaming call (no tools so LLM can only produce text)
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
    signal: AbortSignal.timeout(60_000),
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

// ---------- Stream from fallback LLM ----------

async function streamFromFallbackLLM(
  controller: ReadableStreamDefaultController,
  llm: { client: OpenAI; model: string },
  messages: { role: string; content: string }[],
  agentName: string | undefined,
  agentPersonality: string | null | undefined,
  googleAccessToken: string | null,
  userId?: string
): Promise<void> {
  const encoder = new TextEncoder();
  const hasGoogleTools = !!googleAccessToken;

  const basePrompt = buildSystemPrompt(agentName, agentPersonality);
  const systemPrompt = hasGoogleTools
    ? basePrompt + GOOGLE_TOOLS_PROMPT
    : basePrompt +
      "\n\nWhen users ask you to perform actions (like send emails or schedule meetings), acknowledge the request and suggest they connect their Google account in the Integrations section to enable these features.";

  const llmMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const baseOptions = {
    model: llm.model,
    max_tokens: 1000,
    temperature: 0.7,
    ...(openrouter && userId ? { user: userId } : {}),
  };

  // Tool-calling loop (non-streaming)
  if (hasGoogleTools) {
    let iterations = 0;
    while (iterations < 3) {
      const completion = await llm.client.chat.completions.create({
        ...baseOptions,
        messages: llmMessages,
        tools: GOOGLE_TOOLS,
        stream: false,
      });

      const msg = completion.choices[0]?.message;
      if (!msg?.tool_calls?.length) break;

      llmMessages.push(msg);

      for (const call of msg.tool_calls) {
        if (call.type !== "function") continue;
        controller.enqueue(encoder.encode(sseStatus(toolStatusLabel(call.function.name))));
        const result = await executeToolCall(
          call.function.name,
          JSON.parse(call.function.arguments),
          googleAccessToken!
        );
        llmMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
      iterations++;
    }
  }

  // Final streaming call (no tools so LLM can only produce text)
  const stream = await llm.client.chat.completions.create({
    ...baseOptions,
    messages: llmMessages,
    stream: true,
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

  // Parallel DB lookups
  const [instance, googleAccessToken] = user
    ? await Promise.all([getUserOpenClawInstance(user.id, agentId), getUserGoogleToken(user.id)])
    : [null, null];

  // If we have a running instance, use its identity. Otherwise look up the agent for fallback LLM.
  let agentName = instance?.agentName;
  let agentPersonality = instance?.agentPersonality;
  if (!instance && agentId && user) {
    const agentRecord = await db.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.userId, user.id)),
    });
    if (agentRecord) {
      agentName = agentRecord.name;
      agentPersonality = agentRecord.personality;
    }
  }
  const hasGoogleTools = !!googleAccessToken;

  // Build SSE response stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        // Path 1: Proxy to user's running OpenClaw instance
        if (instance) {
          try {
            await streamFromOpenClaw(controller, instance, messages, {
              tools: hasGoogleTools ? GOOGLE_TOOLS : undefined,
              googleAccessToken: googleAccessToken ?? undefined,
            });
            controller.enqueue(encoder.encode(sseDone()));
            controller.close();
            return;
          } catch (err) {
            console.error("[Chat] OpenClaw proxy failed, falling through to direct LLM:", err);
            // Fall through to direct LLM call
          }
        }

        // Path 2: Direct LLM call (fallback)
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
          googleAccessToken,
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
