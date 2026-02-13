import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents, auditLogs, agentInstances } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { destroyAgent } from "@/lib/provisioning/lifecycle";

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

    // Check if agent has an instance (any status) with serverId
    const instance = await db.query.agentInstances.findFirst({
      where: eq(agentInstances.agentId, id),
    });

    if (instance && instance.serverId) {
      // Real infrastructure: call lifecycle orchestrator
      try {
        await destroyAgent(id);
      } catch (error) {
        console.error("Failed to destroy agent:", error);
        return NextResponse.json(
          {
            error: "Failed to destroy agent",
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

      if (instance) {
        await db
          .update(agentInstances)
          .set({ status: "stopped", updatedAt: new Date() })
          .where(eq(agentInstances.id, instance.id));
      }
    }

    // Log the action
    await db.insert(auditLogs).values({
      userId: user.id,
      agentId: id,
      category: "agent",
      action: "agent_destroyed",
      description: `Agent "${agent.name}" was destroyed`,
      status: "success",
      metadata: {
        previousStatus: agent.status,
        hadInfrastructure: !!(instance && instance.serverId),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Agent destroyed successfully",
    });
  } catch (error) {
    console.error("Destroy agent error:", error);
    return NextResponse.json(
      { error: "Failed to destroy agent" },
      { status: 500 }
    );
  }
}
