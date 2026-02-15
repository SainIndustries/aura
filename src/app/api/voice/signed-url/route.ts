import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { integrations, voiceSettings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptToken } from "@/lib/integrations/encryption";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId } = await request.json();
    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    // Look up voice settings for ConvAI agent ID
    const voice = await db.query.voiceSettings.findFirst({
      where: and(
        eq(voiceSettings.userId, user.id),
        eq(voiceSettings.agentId, agentId),
      ),
    });

    if (!voice?.elevenlabsConvaiAgentId) {
      return NextResponse.json(
        { error: "Voice agent not configured. Create it first." },
        { status: 400 },
      );
    }

    // Get ElevenLabs API key
    const elIntegration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "elevenlabs"),
      ),
    });
    if (!elIntegration?.accessToken) {
      return NextResponse.json(
        { error: "ElevenLabs not connected" },
        { status: 400 },
      );
    }

    const apiKey = decryptToken(elIntegration.accessToken);

    // Get signed URL from ElevenLabs
    const signedRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${voice.elevenlabsConvaiAgentId}`,
      {
        headers: { "xi-api-key": apiKey },
      },
    );

    if (!signedRes.ok) {
      const errBody = await signedRes.text();
      console.error("ElevenLabs signed URL failed:", errBody);
      return NextResponse.json(
        { error: "Failed to get signed URL" },
        { status: 500 },
      );
    }

    const { signed_url } = await signedRes.json();

    return NextResponse.json({ signedUrl: signed_url });
  } catch (error) {
    console.error("Error getting signed URL:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
