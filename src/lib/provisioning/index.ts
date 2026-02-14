import { db } from "@/lib/db";
import { agentInstances, agents } from "@/lib/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { enqueueProvisioningJob } from "./queue";
import { triggerProvisioningWorkflow } from "./github-actions";
import { stopAgent } from "./lifecycle";

export type ProvisioningStatus = {
  id: string;
  agentId: string;
  status: "pending" | "provisioning" | "running" | "stopping" | "stopped" | "failed";
  serverId: string | null;
  serverIp: string | null;
  tailscaleIp: string | null;
  region: string | null;
  error: string | null;
  currentStep: string | null;
  startedAt: Date | null;
  stoppedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProvisioningStep = {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "error";
};

/**
 * Get the provisioning steps based on current status and step
 */
export function getProvisioningSteps(
  status: ProvisioningStatus["status"],
  currentStep?: string | null
): ProvisioningStep[] {
  const steps: ProvisioningStep[] = [
    { id: "queued", label: "Queued", status: "pending" },
    { id: "creating", label: "Creating Server", status: "pending" },
    { id: "installing", label: "Installing Dependencies", status: "pending" },
    { id: "configuring", label: "Configuring Agent", status: "pending" },
    { id: "running", label: "Running", status: "pending" },
  ];

  // Map workflow step identifiers to UI step indices (active step)
  const stepToActiveIndex: Record<string, number> = {
    vm_created: 2,          // steps 0,1 completed, step 2 active
    network_configured: 2,  // networking is sub-step of infra setup
    ansible_started: 3,     // steps 0,1,2 completed, step 3 active
    ansible_complete: 4,    // steps 0,1,2,3 completed, step 4 active
  };

  // Determine active step index based on status and currentStep
  let activeIndex: number;

  if (status === "pending") {
    activeIndex = 0; // Queued is active
  } else if (status === "provisioning") {
    if (currentStep && stepToActiveIndex[currentStep] !== undefined) {
      // Use real step data
      activeIndex = stepToActiveIndex[currentStep];
    } else {
      // Backward compatible: assume step 1 active (Creating Server)
      activeIndex = 1;
    }
  } else if (status === "running" || status === "stopping" || status === "stopped") {
    activeIndex = 5; // All steps completed (activeIndex > last step index)
  } else if (status === "failed") {
    if (currentStep && stepToActiveIndex[currentStep] !== undefined) {
      // Mark the step where failure occurred as error
      const errorIndex = stepToActiveIndex[currentStep];
      return steps.map((step, i) => ({
        ...step,
        status: i < errorIndex ? "completed" : i === errorIndex ? "error" : "pending",
      }));
    } else {
      // Fallback: error at step 2 (Installing Dependencies)
      return steps.map((step, i) => ({
        ...step,
        status: i < 2 ? "completed" : i === 2 ? "error" : "pending",
      }));
    }
  } else {
    activeIndex = 0;
  }

  return steps.map((step, i) => ({
    ...step,
    status: i < activeIndex ? "completed" : i === activeIndex ? "active" : "pending",
  }));
}

/**
 * Queue an agent for provisioning via real infrastructure pipeline
 */
export async function queueAgentProvisioning(agentId: string, region: string = "us-east", userId?: string): Promise<ProvisioningStatus> {
  // Check if agent exists
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) {
    throw new Error("Agent not found");
  }

  const effectiveUserId = userId || agent.userId;

  // Check if there's already an active instance
  const existingInstance = await db.query.agentInstances.findFirst({
    where: and(
      eq(agentInstances.agentId, agentId),
      ne(agentInstances.status, "stopped"),
      ne(agentInstances.status, "failed")
    ),
  });

  if (existingInstance) {
    throw new Error("Agent already has an active or pending instance");
  }

  // Create new instance record
  const [instance] = await db
    .insert(agentInstances)
    .values({
      agentId,
      status: "pending",
      region,
    })
    .returning();

  console.log(`[Provisioning] Queued agent ${agentId} for provisioning in region ${region}`);
  console.log(`[Provisioning] Instance ${instance.id} created with status: pending`);

  // Enqueue provisioning job and trigger GitHub Actions workflow
  try {
    const job = await enqueueProvisioningJob({
      agentId,
      userId: effectiveUserId,
      stripeEventId: `manual-${instance.id}`,
      region,
    });

    console.log(`[Provisioning] Job ${job.id} enqueued, triggering workflow...`);

    await triggerProvisioningWorkflow(job);
  } catch (err) {
    console.error(`[Provisioning] Failed to trigger real pipeline for instance ${instance.id}:`, err);
    // Update instance to failed so user can retry
    await db
      .update(agentInstances)
      .set({ status: "failed", error: err instanceof Error ? err.message : "Failed to trigger provisioning", updatedAt: new Date() })
      .where(eq(agentInstances.id, instance.id));

    throw err;
  }

  return instance as ProvisioningStatus;
}

/**
 * Get the current provisioning status for an agent
 */
export async function getProvisioningStatus(agentId: string): Promise<ProvisioningStatus | null> {
  const instance = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.agentId, agentId),
    orderBy: [desc(agentInstances.createdAt)],
  });

  return instance as ProvisioningStatus | null;
}

/**
 * Get instance by ID
 */
export async function getInstanceById(instanceId: string): Promise<ProvisioningStatus | null> {
  const instance = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.id, instanceId),
  });

  return instance as ProvisioningStatus | null;
}

/**
 * Stop an agent instance
 */
export async function stopAgentInstance(agentId: string): Promise<ProvisioningStatus> {
  const instance = await db.query.agentInstances.findFirst({
    where: and(
      eq(agentInstances.agentId, agentId),
      eq(agentInstances.status, "running")
    ),
  });

  if (!instance) {
    throw new Error("No running instance found for this agent");
  }

  // Update status to stopping
  const [updatedInstance] = await db
    .update(agentInstances)
    .set({
      status: "stopping",
      updatedAt: new Date(),
    })
    .where(eq(agentInstances.id, instance.id))
    .returning();

  console.log(`[Provisioning] Stopping instance ${instance.id}`);

  // Use real lifecycle stop (non-blocking)
  stopAgent(agentId).catch((err) => {
    console.error(`[Provisioning] Stop error for instance ${instance.id}:`, err);
  });

  return updatedInstance as ProvisioningStatus;
}

/**
 * Update instance status (used by simulator)
 */
export async function updateInstanceStatus(
  instanceId: string,
  updates: Partial<{
    status: ProvisioningStatus["status"];
    serverId: string;
    serverIp: string;
    tailscaleIp: string;
    error: string;
    startedAt: Date;
    stoppedAt: Date;
  }>
): Promise<ProvisioningStatus> {
  const [instance] = await db
    .update(agentInstances)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(agentInstances.id, instanceId))
    .returning();

  return instance as ProvisioningStatus;
}
