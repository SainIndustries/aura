import { db } from "@/lib/db";
import { agentInstances, agents } from "@/lib/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { simulateProvisioning, simulateTermination } from "./simulator";
import { progressProvisioning as hetznerProgress, terminateServer } from "./hetzner";

const USE_HETZNER = !!process.env.HETZNER_API_TOKEN;

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
 * Get the provisioning steps based on current status and step.
 *
 * Step identifiers from hetzner.ts:
 *   vm_booting → installing_packages → caddy_up → verifying_chat → running
 */
export function getProvisioningSteps(
  status: ProvisioningStatus["status"],
  currentStep?: string | null
): ProvisioningStep[] {
  const steps: ProvisioningStep[] = [
    { id: "queued", label: "Queued", status: "pending" },
    { id: "creating", label: "Creating Server", status: "pending" },
    { id: "booting", label: "Booting VM", status: "pending" },
    { id: "installing", label: "Installing Software", status: "pending" },
    { id: "starting", label: "Starting Gateway", status: "pending" },
    { id: "verifying", label: "Verifying Chat", status: "pending" },
  ];

  // Map workflow step identifiers to UI step indices (active step)
  const stepToActiveIndex: Record<string, number> = {
    vm_booting: 2,           // steps 0,1 completed, step 2 active
    vm_created: 2,           // legacy compat
    installing_packages: 3,  // steps 0,1,2 completed, step 3 active
    ansible_started: 3,      // legacy compat
    caddy_up: 4,             // steps 0,1,2,3 completed, step 4 active
    verifying_chat: 5,       // steps 0,1,2,3,4 completed, step 5 active
    ansible_complete: 5,     // legacy compat
  };

  const lastIndex = steps.length - 1;

  // Determine active step index based on status and currentStep
  let activeIndex: number;

  if (status === "pending") {
    activeIndex = 0;
  } else if (status === "provisioning") {
    if (currentStep && stepToActiveIndex[currentStep] !== undefined) {
      activeIndex = stepToActiveIndex[currentStep];
    } else {
      activeIndex = 1; // Creating Server
    }
  } else if (status === "running" || status === "stopping" || status === "stopped") {
    activeIndex = lastIndex + 1; // All steps completed
  } else if (status === "failed") {
    if (currentStep && stepToActiveIndex[currentStep] !== undefined) {
      const errorIndex = stepToActiveIndex[currentStep];
      return steps.map((step, i) => ({
        ...step,
        status: i < errorIndex ? "completed" : i === errorIndex ? "error" : "pending",
      }));
    } else {
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
  console.log(`[Provisioning] Using ${USE_HETZNER ? "Hetzner Cloud (poll-driven)" : "Simulator (dev)"}`);

  if (!USE_HETZNER) {
    // Dev-only simulator — runs as background process (fine for local dev server)
    simulateProvisioning(instance.id).catch((err) => {
      console.error(`[Provisioning] Simulation error for instance ${instance.id}:`, err);
    });
  }
  // For Hetzner: provisioning is driven by progressProvisioning() called from the polling endpoint.
  // The instance starts as "pending" and the first poll will create the server.

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

  // Terminate synchronously (fire-and-forget doesn't work on Vercel serverless)
  try {
    if (USE_HETZNER) {
      await terminateServer(instance.id);
    } else {
      await simulateTermination(instance.id);
    }
  } catch (err) {
    console.error(`[Provisioning] Termination error for instance ${instance.id}:`, err);
  }

  // Re-fetch to return latest status after termination
  const finalInstance = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.id, instance.id),
  });

  return (finalInstance ?? updatedInstance) as ProvisioningStatus;
}

/**
 * Progress provisioning for the given instance by one step.
 * Called from the polling endpoint on each UI poll (~1s).
 * Only relevant for Hetzner — simulator handles its own progression.
 */
export async function progressInstanceProvisioning(instanceId: string): Promise<void> {
  if (!USE_HETZNER) return; // Simulator handles its own progression
  try {
    await hetznerProgress(instanceId);
  } catch (err) {
    console.error(`[Provisioning] Progress error for instance ${instanceId}:`, err);
  }
}

/**
 * Update instance status (used by simulator and hetzner provisioner)
 */
export async function updateInstanceStatus(
  instanceId: string,
  updates: Partial<{
    status: ProvisioningStatus["status"];
    serverId: string;
    serverIp: string;
    tailscaleIp: string;
    error: string;
    currentStep: string;
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
