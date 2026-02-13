import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels, callLogs, users } from "@/lib/db/schema";

// Twilio sends form-encoded data
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extract Twilio call data
    const callSid = formData.get("CallSid") as string;
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const callStatus = formData.get("CallStatus") as string;
    const direction = formData.get("Direction") as string || "inbound";
    const accountSid = formData.get("AccountSid") as string;
    
    console.log("[Twilio Voice Webhook]", {
      callSid,
      from,
      to,
      callStatus,
      direction,
    });

    // Find the phone channel configured with this Twilio number
    const phoneChannel = await db.query.channels.findFirst({
      where: and(
        eq(channels.type, "phone"),
        eq(channels.enabled, true)
      ),
      with: {
        user: true,
        agent: true,
      },
    });

    if (!phoneChannel) {
      console.log("[Twilio Voice] No active phone channel found for number:", to);
      // Return a simple TwiML response
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, this number is not configured to receive calls.</Say>
  <Hangup/>
</Response>`,
        {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    const config = phoneChannel.config as Record<string, unknown> | null;
    const greetingMessage = (config?.greetingMessage as string) || "Hello! How can I help you today?";
    const answerMode = (config?.answerMode as string) || "auto";
    const voicemailGreeting = (config?.voicemailGreeting as string) || "Please leave a message after the beep.";
    const businessHours = config?.businessHours as string | undefined;

    // Log the incoming call
    await db.insert(callLogs).values({
      userId: phoneChannel.userId,
      agentId: phoneChannel.agentId,
      channelId: phoneChannel.id,
      twilioCallSid: callSid,
      direction: direction.toLowerCase() as "inbound" | "outbound",
      fromNumber: from,
      toNumber: to,
      status: callStatus,
      metadata: {
        accountSid,
        answeredAt: new Date().toISOString(),
      },
    });

    // Check business hours if configured
    if (businessHours) {
      const isWithinBusinessHours = checkBusinessHours(businessHours);
      if (!isWithinBusinessHours) {
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We're currently outside of business hours. ${voicemailGreeting}</Say>
  <Record maxLength="120" transcribe="true" transcribeCallback="/api/webhooks/twilio/transcription"/>
  <Say voice="alice">Thank you for your message. Goodbye!</Say>
  <Hangup/>
</Response>`,
          {
            status: 200,
            headers: { "Content-Type": "text/xml" },
          }
        );
      }
    }

    // Handle based on answer mode
    if (answerMode === "voicemail") {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${voicemailGreeting}</Say>
  <Record maxLength="120" transcribe="true" transcribeCallback="/api/webhooks/twilio/transcription"/>
  <Say voice="alice">Thank you for your message. Goodbye!</Say>
  <Hangup/>
</Response>`,
        {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    // Auto-answer mode - connect to agent via ElevenLabs
    // For now, return a greeting and gather input
    // In production, this would connect to ElevenLabs Conversational AI
    const elevenLabsAgentId = config?.elevenLabsAgentId as string;
    
    if (elevenLabsAgentId) {
      // Connect to ElevenLabs Conversational AI via WebSocket stream
      // This requires a separate streaming endpoint
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${request.headers.get("host")}/api/webhooks/twilio/stream">
      <Parameter name="agentId" value="${phoneChannel.agentId}" />
      <Parameter name="channelId" value="${phoneChannel.id}" />
      <Parameter name="callSid" value="${callSid}" />
    </Stream>
  </Connect>
</Response>`,
        {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    // Fallback: Simple gather with speech recognition
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${greetingMessage}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/webhooks/twilio/voice/gather">
    <Say voice="alice">I'm listening.</Say>
  </Gather>
  <Say voice="alice">I didn't hear anything. Goodbye!</Say>
  <Hangup/>
</Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  } catch (error) {
    console.error("[Twilio Voice Webhook Error]", error);
    
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, an error occurred. Please try again later.</Say>
  <Hangup/>
</Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  }
}

// Simple business hours checker
// Format: "Mon-Fri 9am-5pm EST" or "24/7"
function checkBusinessHours(businessHours: string): boolean {
  if (businessHours.toLowerCase().includes("24/7")) {
    return true;
  }

  // Parse business hours (simplified version)
  // In production, use a proper time zone library
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();

  // Default: Monday-Friday 9am-5pm
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isBusinessHour = hour >= 9 && hour < 17;

  // Try to parse the string
  const lowerHours = businessHours.toLowerCase();
  
  if (lowerHours.includes("mon-fri") || lowerHours.includes("weekdays")) {
    if (!isWeekday) return false;
  }

  // Basic hour parsing
  const timeMatch = lowerHours.match(/(\d{1,2})(?:am|pm)?-(\d{1,2})(?:am|pm)?/);
  if (timeMatch) {
    let startHour = parseInt(timeMatch[1]);
    let endHour = parseInt(timeMatch[2]);
    
    if (lowerHours.includes("pm") && endHour < 12) {
      endHour += 12;
    }
    
    return hour >= startHour && hour < endHour;
  }

  return isWeekday && isBusinessHour;
}
