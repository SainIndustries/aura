import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rate-limit";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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

You can talk about your capabilities and help users understand what you can do. When users ask you to perform actions (like send emails or schedule meetings), acknowledge the request and explain that the full integration would connect to their actual services.

Keep responses concise but helpful. You're chatting in real-time, so don't write essays.`;

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

    // If OpenAI is not configured, use fallback responses
    if (!openai) {
      const fallbackResponse = getFallbackResponse(messages);
      return NextResponse.json({ message: fallbackResponse });
    }

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that request.";

    return NextResponse.json({ message: response });
  } catch (error) {
    console.error("Chat error:", error);
    
    // If OpenAI fails, use fallback
    const body = await request.clone().json().catch(() => ({ messages: [] }));
    const fallbackResponse = getFallbackResponse(body.messages || []);
    
    return NextResponse.json({ message: fallbackResponse });
  }
}

// Fallback responses when AI is not available
function getFallbackResponse(messages: { role: string; content: string }[]): string {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    return "Hello! I'm Aura, your AI assistant. How can I help you today?";
  }

  const content = lastMessage.content.toLowerCase();
  
  if (content.includes("hello") || content.includes("hi") || content.includes("hey")) {
    return "Hello! I'm Aura, your AI assistant. I can help you manage your emails, schedule meetings, update your CRM, and automate workflows. What can I help you with today?";
  }
  
  if (content.includes("email") || content.includes("inbox")) {
    return "I can help you manage your emails! Once connected, I can:\n\n• **Summarize** unread messages\n• **Draft** replies based on context\n• **Organize** your inbox by priority\n• **Flag** important messages\n\nWould you like to connect your email account in the Integrations section?";
  }
  
  if (content.includes("schedule") || content.includes("meeting") || content.includes("calendar")) {
    return "I'd be happy to help with scheduling! With calendar access, I can:\n\n• **Check** your availability\n• **Suggest** optimal meeting times\n• **Book** appointments automatically\n• **Send** calendar invites\n\nHead to Integrations to connect your Google Calendar or Outlook.";
  }
  
  if (content.includes("task") || content.includes("todo") || content.includes("remind")) {
    return "I can help you stay organized! I can:\n\n• **Create** reminders for important tasks\n• **Track** your todo list\n• **Prioritize** items by urgency\n• **Follow up** on deadlines\n\nJust tell me what you need to remember!";
  }

  if (content.includes("help") || content.includes("what can you do")) {
    return "I'm Aura, your AI executive assistant! Here's what I can help with:\n\n📧 **Email** — Summarize, draft, and organize\n📅 **Calendar** — Schedule meetings and manage events\n💼 **CRM** — Update contacts and track deals\n✅ **Tasks** — Create reminders and track todos\n🔍 **Research** — Find information and summarize content\n💬 **Communications** — Draft messages for any platform\n\nConnect your tools in the Integrations section to unlock full capabilities!";
  }

  if (content.includes("crm") || content.includes("sales") || content.includes("deal") || content.includes("contact")) {
    return "I can help manage your CRM! With access to Salesforce, HubSpot, or your preferred CRM, I can:\n\n• **Update** contact information automatically\n• **Log** meeting notes and calls\n• **Track** deal progress\n• **Send** follow-up reminders\n\nConnect your CRM in the Integrations section to get started.";
  }
  
  return "I understand! Let me help you with that. Could you tell me a bit more about what you're looking to accomplish? I can assist with email, calendar, tasks, CRM updates, and more.";
}
