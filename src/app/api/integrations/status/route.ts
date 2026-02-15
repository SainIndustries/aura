import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { agents, integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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

    // Check if user has a running OpenClaw instance
    const userAgents = await db.query.agents.findMany({
      where: eq(agents.userId, user.id),
      with: { instances: true },
    });

    const hasRunningInstance = userAgents.some((agent) =>
      (agent.instances ?? []).some(
        (inst) => inst.status === "running" && inst.serverIp
      )
    );

    return NextResponse.json({
      google: {
        connected: !!googleIntegration,
        email: (googleIntegration?.metadata as { email?: string })?.email,
      },
      openclaw: {
        running: hasRunningInstance,
      },
    });
  } catch (error) {
    console.error("Error fetching integration status:", error);
    return NextResponse.json(
      { error: "Failed to fetch integration status" },
      { status: 500 }
    );
  }
}
