import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { agents, integrations, voiceSettings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptToken } from "@/lib/integrations/encryption";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

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

    // Look up the Aura agent
    const agent = await db.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.userId, user.id)),
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
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
        { error: "ElevenLabs not connected. Please add your API key in Integrations." },
        { status: 400 },
      );
    }

    const apiKey = decryptToken(elIntegration.accessToken);

    // Check for existing voice settings
    const existingVoice = await db.query.voiceSettings.findFirst({
      where: and(
        eq(voiceSettings.userId, user.id),
        eq(voiceSettings.agentId, agentId),
      ),
    });

    // Always recreate — pick up personality changes and ensure custom LLM config
    // Delete old ConvAI agent if it exists
    if (existingVoice?.elevenlabsConvaiAgentId) {
      try {
        await fetch(`${ELEVENLABS_API}/convai/agents/${existingVoice.elevenlabsConvaiAgentId}`, {
          method: "DELETE",
          headers: { "xi-api-key": apiKey },
        });
      } catch (err) {
        console.warn("Failed to delete old ElevenLabs agent:", err);
      }
    }

    // Generate a secure LLM proxy token
    const llmProxyToken = randomBytes(32).toString("hex");

    // Build the custom LLM URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL is not configured" },
        { status: 500 },
      );
    }
    // ElevenLabs appends /chat/completions to this base URL, so we use path
    // segments instead of query params (query params would get mangled).
    const llmProxyUrl = `${appUrl}/api/voice/llm-proxy/${agentId}/${llmProxyToken}`;

    // Create ElevenLabs secret for the proxy token
    const secretRes = await fetch(`${ELEVENLABS_API}/convai/secrets`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `aura-proxy-${agentId.slice(0, 8)}`,
        secret_value: llmProxyToken,
      }),
    });

    if (!secretRes.ok) {
      const errBody = await secretRes.text();
      console.error("ElevenLabs secret creation failed:", errBody);
      // Non-fatal — the token is embedded in the URL query param as well
    }

    const voiceId = existingVoice?.elevenlabsVoiceId || undefined;

    // Create ElevenLabs Conversational AI agent with custom LLM.
    // NOTE: Do NOT set `prompt` here — the LLM proxy already prepends its own
    // system prompt via buildSystemPrompt(). Setting it in both places causes
    // the LLM to receive duplicate system instructions.
    const createRes = await fetch(`${ELEVENLABS_API}/convai/agents/create`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: agent.name,
        conversation_config: {
          agent: {
            prompt: {
              llm: "custom-llm",
              custom_llm: {
                url: llmProxyUrl,
                model_id: "openclaw",
              },
            },
            first_message: `Hey! I'm ${agent.name}. How can I help you today?`,
            language: "en",
          },
          tts: voiceId ? { voice_id: voiceId } : undefined,
        },
      }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      console.error("ElevenLabs agent creation failed:", errBody);
      return NextResponse.json(
        { error: "Failed to create voice agent" },
        { status: 500 },
      );
    }

    const created = await createRes.json();
    const convaiAgentId = created.agent_id;

    // Upsert voice settings with the new ConvAI agent ID and proxy token
    if (existingVoice) {
      await db
        .update(voiceSettings)
        .set({
          elevenlabsConvaiAgentId: convaiAgentId,
          llmProxyToken,
          updatedAt: new Date(),
        })
        .where(eq(voiceSettings.id, existingVoice.id));
    } else {
      await db.insert(voiceSettings).values({
        userId: user.id,
        agentId,
        elevenlabsConvaiAgentId: convaiAgentId,
        llmProxyToken,
      });
    }

    return NextResponse.json({ elevenlabsAgentId: convaiAgentId });
  } catch (error) {
    console.error("Error creating ElevenLabs agent:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
