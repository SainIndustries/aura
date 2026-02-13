import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// This is a placeholder implementation
// Replace with actual AI provider (OpenAI, Anthropic, etc.)
async function generateResponse(messages: { role: string; content: string }[]): Promise<string> {
  const lastMessage = messages[messages.length - 1];
  
  // Simple response logic - replace with actual AI
  const responses = [
    "I'm Aura, your AI assistant. I can help you with scheduling, email management, CRM updates, and more. What would you like me to help you with?",
    "I'd be happy to help with that! Let me look into it for you.",
    "Great question! Based on what you've told me, I think we should...",
    "I understand. Let me break this down for you...",
    "I've noted that. Would you like me to take any action on this?",
  ];

  // For demo purposes, return contextual responses
  const content = lastMessage.content.toLowerCase();
  
  if (content.includes("hello") || content.includes("hi") || content.includes("hey")) {
    return "Hello! I'm Aura, your AI assistant. I can help you manage your emails, schedule meetings, update your CRM, and automate workflows. What can I help you with today?";
  }
  
  if (content.includes("email") || content.includes("inbox")) {
    return "I can help you manage your emails! I can summarize unread messages, draft replies, or help you organize your inbox. What would you like me to do?";
  }
  
  if (content.includes("schedule") || content.includes("meeting") || content.includes("calendar")) {
    return "I can help with scheduling! I can check your calendar for availability, suggest meeting times, or help you set up a new event. What do you need?";
  }
  
  if (content.includes("task") || content.includes("todo") || content.includes("remind")) {
    return "I can help you stay organized! Would you like me to create a reminder, add a task to your list, or review your current todos?";
  }

  if (content.includes("help") || content.includes("what can you do")) {
    return "I can help you with:\n\n• **Email** - Summarize, draft, and organize\n• **Calendar** - Schedule meetings and manage events\n• **CRM** - Update contacts and deals\n• **Tasks** - Create reminders and track todos\n• **Research** - Find information and summarize content\n• **Communications** - Draft messages for Slack, Teams, etc.\n\nJust tell me what you need!";
  }
  
  // Default response
  return responses[Math.floor(Math.random() * responses.length)];
}

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

    // Generate response
    const response = await generateResponse(messages);

    return NextResponse.json({ message: response });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
