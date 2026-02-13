import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { callLogs } from "@/lib/db/schema";

/**
 * Handles Twilio call status updates
 * Called when call status changes (ringing, in-progress, completed, failed, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract Twilio status data
    const callSid = formData.get("CallSid") as string;
    const callStatus = formData.get("CallStatus") as string;
    const callDuration = formData.get("CallDuration") as string;
    const recordingUrl = formData.get("RecordingUrl") as string | null;
    const recordingSid = formData.get("RecordingSid") as string | null;
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const direction = formData.get("Direction") as string;
    const timestamp = formData.get("Timestamp") as string;

    console.log("[Twilio Status Webhook]", {
      callSid,
      callStatus,
      callDuration,
      recordingUrl,
      direction,
    });

    // Update the call log with the new status
    const existingLog = await db.query.callLogs.findFirst({
      where: eq(callLogs.twilioCallSid, callSid),
    });

    if (existingLog) {
      // Update existing call log
      await db
        .update(callLogs)
        .set({
          status: callStatus,
          duration: callDuration ? parseInt(callDuration) : null,
          recordingUrl: recordingUrl || existingLog.recordingUrl,
          recordingSid: recordingSid || existingLog.recordingSid,
          endedAt: isTerminalStatus(callStatus) ? new Date() : null,
          metadata: {
            ...(existingLog.metadata as Record<string, unknown> || {}),
            lastStatusUpdate: new Date().toISOString(),
            statusHistory: [
              ...((existingLog.metadata as Record<string, unknown>)?.statusHistory as string[] || []),
              `${callStatus} at ${timestamp || new Date().toISOString()}`,
            ],
          },
        })
        .where(eq(callLogs.twilioCallSid, callSid));

      console.log("[Twilio Status] Updated call log:", callSid, "->", callStatus);
    } else {
      console.log("[Twilio Status] No existing call log found for:", callSid);
    }

    // Return empty 200 response (Twilio expects this)
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[Twilio Status Webhook Error]", error);
    // Still return 200 to prevent Twilio retries
    return new NextResponse(null, { status: 200 });
  }
}

/**
 * Check if the status indicates the call has ended
 */
function isTerminalStatus(status: string): boolean {
  return [
    "completed",
    "failed",
    "busy",
    "no-answer",
    "canceled",
  ].includes(status.toLowerCase());
}
