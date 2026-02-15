import { db } from "@/lib/db";
import { agentInstances, agents } from "@/lib/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { simulateProvisioning, simulateTermination } from "./simulator";
import { provisionServer, terminateServer } from "./hetzner";

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
 * Get the provisioning steps based on current status
 */
export function getProvisioningSteps(status: ProvisioningStatus["status"]): ProvisioningStep[] {
  const steps: ProvisioningStep[] = [
    { id: "queued", label: "Queued", status: "pending" },
    { id: "creating", label: "Creating Server", status: "pending" },
    { id: "installing", label: "Installing Dependencies", status: "pending" },
    { id: "configuring", label: "Configuring Agent", status: "pending" },
    { id: "running", label: "Running", status: "pending" },
  ];

  const statusToStepIndex: Record<string, number> = {
    pending: 0,
    provisioning: 2, // Mid-way through the process
    running: 4,
    stopping: 4,
    stopped: 4,
    failed: -1,
  };

  const activeIndex = statusToStepIndex[status] ?? 0;

  if (status === "failed") {
    // Mark last step as error
    return steps.map((step, i) => ({
      ...step,
      status: i < 2 ? "completed" : i === 2 ? "error" : "pending",
    }));
  }

  return steps.map((step, i) => ({
    ...step,
    status: i < activeIndex ? "completed" : i === activeIndex ? "active" : "pending",
  }));
}

/**
 * Queue an agent for provisioning
 */
export async function queueAgentProvisioning(agentId: string, region: string = "us-east"): Promise<ProvisioningStatus> {
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
  console.log(`[Provisioning] Using ${USE_HETZNER ? "Hetzner Cloud" : "simulator"}`);

  // Start provisioning (non-blocking)
  if (USE_HETZNER) {
    provisionServer(instance.id).catch((err) => {
      console.error(`[Provisioning] Hetzner error for instance ${instance.id}:`, err);
    });
  } else {
    simulateProvisioning(instance.id).catch((err) => {
      console.error(`[Provisioning] Simulation error for instance ${instance.id}:`, err);
    });
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

  // Start termination (non-blocking)
  if (USE_HETZNER) {
    terminateServer(instance.id).catch((err) => {
      console.error(`[Provisioning] Hetzner termination error for instance ${instance.id}:`, err);
    });
  } else {
    simulateTermination(instance.id).catch((err) => {
      console.error(`[Provisioning] Simulation termination error for instance ${instance.id}:`, err);
    });
  }

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
