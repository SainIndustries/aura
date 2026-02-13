import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents, auditLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";

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

    if (agent.status === "paused") {
      return NextResponse.json(
        { error: "Agent is already paused" },
        { status: 400 }
      );
    }

    // Update agent status to paused
    await db
      .update(agents)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(agents.id, id));

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
      agent: { ...agent, status: "paused" },
    });
  } catch (error) {
    console.error("Stop agent error:", error);
    return NextResponse.json(
      { error: "Failed to stop agent" },
      { status: 500 }
    );
  }
}
