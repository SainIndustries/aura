import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { agents, agentInstances, integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
    return { client: openrouter, model: "anthropic/claude-sonnet-4-5-20250929" };
  }
  if (openai) {
    return { client: openai, model: "gpt-4.1-mini" };
  }
  return null;
}

const SYSTEM_PROMPT = `You are Aura, an AI executive assistant built by SAIN Industries. You help users manage their work and life by:

- Managing emails: Summarizing, drafting, and organizing
- Calendar & Scheduling: Booking meetings, checking availability
- CRM: Updating contacts, deals, and pipeline
- Task Management: Creating reminders, tracking todos
- Research: Finding information, summarizing content
- Communications: Drafting messages for Slack, Teams, etc.

Personality:
- Be helpful, concise, and professional
- Use a friendly but efficient tone
- Ask clarifying questions when needed
- Offer proactive suggestions
- Format responses with markdown when helpful (bold, lists, etc.)

Keep responses concise but helpful. You're chatting in real-time, so don't write essays.`;

const GOOGLE_TOOLS_PROMPT = `

You have access to the user's Gmail and Google Calendar. You can:
- List and read emails (use list_emails, read_email)
- Send emails (use send_email)
- List calendar events (use list_calendar_events)
- Create calendar events (use create_calendar_event)

Use these tools proactively when the user asks about emails, scheduling, or calendar.
When listing emails, summarize them concisely. When creating events or sending emails, confirm details with the user before executing.`;

// ---------- OpenClaw instance lookup ----------

interface OpenClawInstance {
  serverIp: string;
  gatewayToken: string;
}

/**
 * Find the user's running OpenClaw instance (first running agent).
 * Returns the server IP and gateway auth token for proxying.
 */
async function getUserOpenClawInstance(userId: string): Promise<OpenClawInstance | null> {
  // Find agents owned by this user
  const userAgents = await db.query.agents.findMany({
    where: eq(agents.userId, userId),
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

// ---------- Proxy to OpenClaw Gateway ----------

async function proxyToOpenClaw(
  instance: OpenClawInstance,
  messages: { role: string; content: string }[]
): Promise<string> {
  // OpenClaw exposes an OpenAI-compatible endpoint at /v1/chat/completions
  const url = `http://${instance.serverIp}/v1/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${instance.gatewayToken}`,
    },
    body: JSON.stringify({
      model: "openclaw",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      stream: false,
    }),
    signal: AbortSignal.timeout(60_000), // 60s timeout for tool-heavy requests
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenClaw gateway error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return (
    data.choices?.[0]?.message?.content ||
    "I'm sorry, I couldn't process that request."
  );
}

// ---------- Main handler ----------

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for") || "anonymous";
    const { success } = await checkRateLimit(`chat:${ip}`);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();

    // ---------- Path 1: Proxy to user's running OpenClaw instance ----------
    if (user) {
      const instance = await getUserOpenClawInstance(user.id);

      if (instance) {
        try {
          const response = await proxyToOpenClaw(instance, messages);
          return NextResponse.json({ message: response });
        } catch (err) {
          console.error("[Chat] OpenClaw proxy failed, falling through to direct LLM:", err);
          // Fall through to direct LLM call
        }
      }
    }

    // ---------- Path 2: Direct LLM call (fallback when no running instance) ----------
    const llm = getFallbackLLM();

    if (!llm) {
      const fallbackResponse = getFallbackResponse(messages);
      return NextResponse.json({ message: fallbackResponse });
    }

    // Check if user has Google connected (for fallback tool calling)
    const googleAccessToken = user ? await getUserGoogleToken(user.id) : null;
    const hasGoogleTools = !!googleAccessToken;

    // Build system prompt
    const systemPrompt = hasGoogleTools
      ? SYSTEM_PROMPT + GOOGLE_TOOLS_PROMPT
      : SYSTEM_PROMPT +
        "\n\nWhen users ask you to perform actions (like send emails or schedule meetings), acknowledge the request and suggest they connect their Google account in the Integrations section to enable these features.";

    const llmMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const llmOptions: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: llm.model,
      messages: llmMessages,
      max_tokens: 1000,
      temperature: 0.7,
      ...(hasGoogleTools ? { tools: GOOGLE_TOOLS } : {}),
      ...(openrouter && user ? { user: user.id } : {}),
    };

    // Initial LLM call
    let completion = await llm.client.chat.completions.create(llmOptions);

    // Tool call loop (max 3 iterations)
    let iterations = 0;
    while (
      completion.choices[0]?.message?.tool_calls?.length &&
      iterations < 3 &&
      googleAccessToken
    ) {
      const assistantMessage = completion.choices[0].message;
      llmMessages.push(assistantMessage);

      for (const call of assistantMessage.tool_calls!) {
        if (call.type !== "function") continue;
        const result = await executeToolCall(
          call.function.name,
          JSON.parse(call.function.arguments),
          googleAccessToken
        );

        llmMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }

      completion = await llm.client.chat.completions.create({
        ...llmOptions,
        messages: llmMessages,
      });

      iterations++;
    }

    const response =
      completion.choices[0]?.message?.content ||
      "I'm sorry, I couldn't process that request.";

    return NextResponse.json({
      message: response,
      ...(completion.usage ? { tokensUsed: completion.usage.total_tokens } : {}),
    });
  } catch (error) {
    console.error("Chat error:", error);

    const body = await request
      .clone()
      .json()
      .catch(() => ({ messages: [] }));
    const fallbackResponse = getFallbackResponse(body.messages || []);

    return NextResponse.json({ message: fallbackResponse });
  }
}

// Fallback responses when AI is not available
function getFallbackResponse(
  messages: { role: string; content: string }[]
): string {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    return "Hello! I'm Aura, your AI assistant. How can I help you today?";
  }

  const content = lastMessage.content.toLowerCase();

  if (
    content.includes("hello") ||
    content.includes("hi") ||
    content.includes("hey")
  ) {
    return "Hello! I'm Aura, your AI assistant. I can help you manage your emails, schedule meetings, update your CRM, and automate workflows. What can I help you with today?";
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
    return "I'm Aura, your AI executive assistant! Here's what I can help with:\n\n**Email** -- Summarize, draft, and organize\n**Calendar** -- Schedule meetings and manage events\n**CRM** -- Update contacts and track deals\n**Tasks** -- Create reminders and track todos\n**Research** -- Find information and summarize content\n**Communications** -- Draft messages for any platform\n\nConnect your tools in the Integrations section to unlock full capabilities!";
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
