import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getProvisioningStatus,
  stopAgentInstance,
  getProvisioningSteps,
  progressInstanceProvisioning,
} from "@/lib/provisioning";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify agent belongs to user
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    if (!agent || agent.userId !== user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get current instance
    let instance = await getProvisioningStatus(id);

    if (!instance) {
      return NextResponse.json({
        instance: null,
        steps: null,
        uptime: null,
      });
    }

    // Drive provisioning forward one step if still in progress
    if (instance.status === "pending" || instance.status === "provisioning") {
      await progressInstanceProvisioning(instance.id);
      // Re-fetch after progression to return updated status
      instance = (await getProvisioningStatus(id))!;
    }

    // Calculate uptime if running
    let uptime: number | null = null;
    if (instance.status === "running" && instance.startedAt) {
      uptime = Math.floor((Date.now() - new Date(instance.startedAt).getTime()) / 1000);
    }

    const steps = getProvisioningSteps(instance.status, instance.currentStep);

    return NextResponse.json({
      instance,
      steps,
      uptime,
    });
  } catch (error) {
    console.error("Error getting instance:", error);
    return NextResponse.json(
      { error: "Failed to get instance" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify agent belongs to user
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    if (!agent || agent.userId !== user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Stop the instance
    const instance = await stopAgentInstance(id);
    const steps = getProvisioningSteps(instance.status, instance.currentStep);

    return NextResponse.json({
      instance,
      steps,
    });
  } catch (error) {
    console.error("Error stopping instance:", error);
    const message = error instanceof Error ? error.message : "Failed to stop instance";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
