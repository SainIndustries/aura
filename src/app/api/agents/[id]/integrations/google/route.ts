import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { agents, integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/agents/[id]/integrations/google
 * Enable Google integration for the specified agent.
 * Requires the user to already have a Google OAuth connection.
 *
 * DELETE /api/agents/[id]/integrations/google
 * Disable Google integration for the specified agent.
 */

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: agentId } = await params;

  // Verify the agent belongs to the user
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.userId, user.id)),
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Verify user has a Google OAuth connection
  const googleIntegration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.userId, user.id),
      eq(integrations.provider, "google")
    ),
  });

  if (!googleIntegration) {
    return NextResponse.json(
      { error: "Google account not connected. Please connect Google first." },
      { status: 400 }
    );
  }

  // Enable Google on this agent
  const currentIntegrations = (agent.integrations as Record<string, unknown>) ?? {};
  await db
    .update(agents)
    .set({
      integrations: { ...currentIntegrations, google: true },
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId));

  return NextResponse.json({ success: true, google: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: agentId } = await params;

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.userId, user.id)),
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Disable Google on this agent
  const currentIntegrations = (agent.integrations as Record<string, unknown>) ?? {};
  await db
    .update(agents)
    .set({
      integrations: { ...currentIntegrations, google: false },
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId));

  return NextResponse.json({ success: true, google: false });
}
