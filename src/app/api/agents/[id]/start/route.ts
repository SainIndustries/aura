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

    if (agent.status === "active") {
      return NextResponse.json(
        { error: "Agent is already active" },
        { status: 400 }
      );
    }

    // Update agent status to active
    await db
      .update(agents)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(agents.id, id));

    // Log the action
    await db.insert(auditLogs).values({
      userId: user.id,
      agentId: id,
      category: "agent",
      action: "agent_started",
      description: `Agent "${agent.name}" was activated`,
      status: "success",
      metadata: {
        previousStatus: agent.status,
        newStatus: "active",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Agent started successfully",
      agent: { ...agent, status: "active" },
    });
  } catch (error) {
    console.error("Start agent error:", error);
    return NextResponse.json(
      { error: "Failed to start agent" },
      { status: 500 }
    );
  }
}
