import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "elevenlabs";

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

// GET /api/integrations/elevenlabs/voices - List available voices
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    if (!integration || !integration.accessToken) {
      return NextResponse.json(
        { error: "ElevenLabs not connected. Please connect first." },
        { status: 400 }
      );
    }

    const apiKey = decryptToken(integration.accessToken);

    // Fetch voices from ElevenLabs API
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: "Invalid API key. Please reconnect ElevenLabs." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch voices from ElevenLabs" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const voices: ElevenLabsVoice[] = data.voices || [];

    // Also fetch available models
    const modelsResponse = await fetch("https://api.elevenlabs.io/v1/models", {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    let models: { model_id: string; name: string; description: string }[] = [];
    if (modelsResponse.ok) {
      const modelsData = await modelsResponse.json();
      models = modelsData || [];
    }

    return NextResponse.json({
      voices: voices.map((v) => ({
        id: v.voice_id,
        name: v.name,
        category: v.category,
        description: v.description,
        labels: v.labels,
        previewUrl: v.preview_url,
      })),
      models: models.map((m) => ({
        id: m.model_id,
        name: m.name,
        description: m.description,
      })),
    });
  } catch (error) {
    console.error("Error fetching ElevenLabs voices:", error);
    return NextResponse.json(
      { error: "Failed to fetch voices" },
      { status: 500 }
    );
  }
}
