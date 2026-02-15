import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents, auditLogs, agentInstances } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { stopAgent } from "@/lib/provisioning/lifecycle";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agent = await db.query.agents.findFirst({
      where: and(eq(agents.id, id), eq(agents.userId, user.id)),
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.status !== "active") {
      return NextResponse.json(
        { error: "Agent is not running" },
        { status: 400 }
      );
    }

    // Check if agent has a running instance with serverId
    const instance = await db.query.agentInstances.findFirst({
      where: and(
        eq(agentInstances.agentId, id),
        eq(agentInstances.status, "running")
      ),
    });

    if (instance && instance.serverId) {
      // Real infrastructure: call lifecycle orchestrator
      try {
        await stopAgent(id);
      } catch (error) {
        console.error("Failed to stop agent:", error);
        return NextResponse.json(
          {
            error: "Failed to stop agent",
            details: error instanceof Error ? error.message : "Unknown error"
          },
          { status: 500 }
        );
      }
    } else {
      // Legacy/simulated agent: just update status in DB
      await db
        .update(agents)
        .set({ status: "paused", updatedAt: new Date() })
        .where(eq(agents.id, id));
    }

    // Log the action
    await db.insert(auditLogs).values({
      userId: user.id,
      agentId: id,
      category: "agent",
      action: "agent_stopped",
      description: `Agent "${agent.name}" was paused`,
      status: "success",
      metadata: {
        previousStatus: agent.status,
        newStatus: "paused",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Agent stopped successfully",
      agent: { ...agent, status: "paused" as const },
    });
  } catch (error) {
    console.error("Stop agent error:", error);
    return NextResponse.json(
      { error: "Failed to stop agent" },
      { status: 500 }
    );
  }
}
