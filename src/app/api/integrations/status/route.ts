import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { agents, integrations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check Google integration
    const googleIntegration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "google")
      ),
    });

    // Check ElevenLabs integration
    const elevenlabsIntegration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "elevenlabs")
      ),
    });

    // Get all connected providers for notification detection
    const allIntegrations = await db.query.integrations.findMany({
      where: eq(integrations.userId, user.id),
      columns: { provider: true },
    });
    const connectedProviders = allIntegrations.map((i) => i.provider);

    // Check if user has a running OpenClaw instance
    const userAgents = await db.query.agents.findMany({
      where: eq(agents.userId, user.id),
      orderBy: [desc(agents.updatedAt)],
      with: { instances: true },
    });

    const agentsList = userAgents
      .filter((agent) =>
        agent.status === "active" ||
        (agent.instances ?? []).some((inst) => inst.status === "running")
      )
      .map((agent) => {
        const agentIntegrations = (agent.integrations as Record<string, unknown>) ?? {};
        return {
          id: agent.id,
          name: agent.name,
          running: (agent.instances ?? []).some(
            (inst) => inst.status === "running"
          ),
          integrations: {
            google: !!agentIntegrations.google && !!googleIntegration,
            slack: !!agentIntegrations.slack,
            elevenlabs: !!agentIntegrations.elevenlabs && !!elevenlabsIntegration,
          },
        };
      });

    const firstRunning = agentsList.find((a) => a.running);

    return NextResponse.json({
      google: {
        connected: !!googleIntegration,
        email: (googleIntegration?.metadata as { email?: string })?.email,
      },
      elevenlabs: {
        connected: !!elevenlabsIntegration,
      },
      openclaw: {
        running: !!firstRunning,
        ...(firstRunning ? { agentName: firstRunning.name } : {}),
      },
      agents: agentsList,
      connectedProviders,
    });
  } catch (error) {
    console.error("Error fetching integration status:", error);
    return NextResponse.json(
      { error: "Failed to fetch integration status" },
      { status: 500 }
    );
  }
}
