import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { voiceSettings, integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";

// GET /api/voice-settings - Get voice settings for user or agent
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    // Check if ElevenLabs and Twilio are connected
    const [elevenlabsIntegration, twilioIntegration] = await Promise.all([
      db.query.integrations.findFirst({
        where: and(
          eq(integrations.userId, user.id),
          eq(integrations.provider, "elevenlabs")
        ),
      }),
      db.query.integrations.findFirst({
        where: and(
          eq(integrations.userId, user.id),
          eq(integrations.provider, "twilio")
        ),
      }),
    ]);

    // Get voice settings
    const settings = await db.query.voiceSettings.findFirst({
      where: agentId
        ? and(
            eq(voiceSettings.userId, user.id),
            eq(voiceSettings.agentId, agentId)
          )
        : and(
            eq(voiceSettings.userId, user.id),
            eq(voiceSettings.agentId, null as unknown as string) // User-level settings (no agent)
          ),
    });

    return NextResponse.json({
      settings: settings || null,
      integrations: {
        elevenlabs: {
          connected: !!elevenlabsIntegration,
          connectedAt: elevenlabsIntegration?.connectedAt,
        },
        twilio: {
          connected: !!twilioIntegration,
          connectedAt: twilioIntegration?.connectedAt,
          metadata: twilioIntegration?.metadata,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching voice settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch voice settings" },
      { status: 500 }
    );
  }
}

// POST /api/voice-settings - Create or update voice settings
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      agentId,
      elevenlabsVoiceId,
      elevenlabsModelId,
      twilioPhoneNumber,
      callHandlingEnabled,
      voicemailEnabled,
    } = body;

    // Check if settings already exist
    const existing = await db.query.voiceSettings.findFirst({
      where: agentId
        ? and(
            eq(voiceSettings.userId, user.id),
            eq(voiceSettings.agentId, agentId)
          )
        : and(
            eq(voiceSettings.userId, user.id),
            eq(voiceSettings.agentId, null as unknown as string)
          ),
    });

    const settingsData = {
      elevenlabsVoiceId: elevenlabsVoiceId || null,
      elevenlabsModelId: elevenlabsModelId || null,
      twilioPhoneNumber: twilioPhoneNumber || null,
      callHandlingEnabled: callHandlingEnabled ?? false,
      voicemailEnabled: voicemailEnabled ?? true,
      updatedAt: new Date(),
    };

    if (existing) {
      // Update existing settings
      await db
        .update(voiceSettings)
        .set(settingsData)
        .where(eq(voiceSettings.id, existing.id));

      return NextResponse.json({ success: true, updated: true });
    }

    // Create new settings
    const [newSettings] = await db
      .insert(voiceSettings)
      .values({
        userId: user.id,
        agentId: agentId || null,
        ...settingsData,
      })
      .returning();

    return NextResponse.json(
      { success: true, settings: newSettings },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving voice settings:", error);
    return NextResponse.json(
      { error: "Failed to save voice settings" },
      { status: 500 }
    );
  }
}

// DELETE /api/voice-settings - Delete voice settings
export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    const settings = await db.query.voiceSettings.findFirst({
      where: agentId
        ? and(
            eq(voiceSettings.userId, user.id),
            eq(voiceSettings.agentId, agentId)
          )
        : and(
            eq(voiceSettings.userId, user.id),
            eq(voiceSettings.agentId, null as unknown as string)
          ),
    });

    if (!settings) {
      return NextResponse.json(
        { error: "Voice settings not found" },
        { status: 404 }
      );
    }

    await db.delete(voiceSettings).where(eq(voiceSettings.id, settings.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting voice settings:", error);
    return NextResponse.json(
      { error: "Failed to delete voice settings" },
      { status: 500 }
    );
  }
}
