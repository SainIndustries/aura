import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getUserSubscription } from "@/lib/subscription";
import {
  queueAgentProvisioning,
  getProvisioningStatus,
  getProvisioningSteps,
  progressInstanceProvisioning,
} from "@/lib/provisioning";

export async function POST(
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

    // Check for active subscription (subscription gates provisioning)
    const subscription = await getUserSubscription(user.id);
    if (!subscription || !subscription.isActive) {
      return NextResponse.json(
        {
          error: "Active subscription required to deploy agents. Please subscribe in Settings.",
          errorCode: "NO_ACTIVE_SUBSCRIPTION"
        },
        { status: 403 }
      );
    }

    // Parse optional region from request body
    let region = "us-east";
    try {
      const body = await request.json();
      if (body.region) {
        region = body.region;
      }
    } catch {
      // No body provided, use default region
    }

    // Queue the agent for provisioning via real infrastructure pipeline
    const instance = await queueAgentProvisioning(id, region, user.id);
    const steps = getProvisioningSteps(instance.status);

    return NextResponse.json({
      instance,
      steps,
    });
  } catch (error) {
    console.error("Error queuing provisioning:", error);
    const message = error instanceof Error ? error.message : "Failed to queue provisioning";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

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

    // Get current provisioning status
    let instance = await getProvisioningStatus(id);

    if (!instance) {
      return NextResponse.json({
        instance: null,
        steps: null,
      });
    }

    // Drive provisioning forward if still in progress
    if (instance.status === "pending" || instance.status === "provisioning") {
      await progressInstanceProvisioning(instance.id);
      instance = (await getProvisioningStatus(id))!;
    }

    const steps = getProvisioningSteps(instance.status, instance.currentStep);

    return NextResponse.json({
      instance,
      steps,
    });
  } catch (error) {
    console.error("Error getting provisioning status:", error);
    return NextResponse.json(
      { error: "Failed to get provisioning status" },
      { status: 500 }
    );
  }
}
