/**
 * Agent lifecycle orchestrator
 * Coordinates stop/start/destroy/rollback operations for agent instances
 */

import { shutdownServer, powerOnServer, deleteServer } from "../hetzner";
import { deleteDevice, findDeviceByIp } from "../tailscale";
import { db } from "@/lib/db";
import { agentInstances, agents, provisioningJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Stop a running agent instance
 * Performs graceful shutdown and updates database state atomically
 * @param agentId - The agent ID to stop
 * @throws Error if no running instance found or shutdown fails
 */
export async function stopAgent(agentId: string): Promise<void> {
  // Query for running instance
  const instances = await db
    .select()
    .from(agentInstances)
    .where(
      and(
        eq(agentInstances.agentId, agentId),
        eq(agentInstances.status, "running")
      )
    )
    .limit(1);

  const instance = instances[0];
  if (!instance) {
    throw new Error("No running instance to stop");
  }

  // Update to stopping state
  await db
    .update(agentInstances)
    .set({ status: "stopping", updatedAt: new Date() })
    .where(eq(agentInstances.id, instance.id));

  try {
    // Shutdown the server
    if (!instance.serverId) {
      throw new Error("Instance has no server ID");
    }
    await shutdownServer(parseInt(instance.serverId));

    // Update to stopped state
    await db
      .update(agentInstances)
      .set({
        status: "stopped",
        stoppedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentInstances.id, instance.id));

    // Update agent status to paused
    await db
      .update(agents)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(agents.id, agentId));

    console.log(`[Lifecycle] Agent ${agentId} stopped successfully`);
  } catch (error) {
    // Rollback to running state on failure
    await db
      .update(agentInstances)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(agentInstances.id, instance.id));

    throw error;
  }
}

/**
 * Start a stopped agent instance
 * Powers on the VM and updates database state atomically
 * @param agentId - The agent ID to start
 * @throws Error if no stopped instance found or power on fails
 */
export async function startAgent(agentId: string): Promise<void> {
  // Query for stopped instance
  const instances = await db
    .select()
    .from(agentInstances)
    .where(
      and(
        eq(agentInstances.agentId, agentId),
        eq(agentInstances.status, "stopped")
      )
    )
    .limit(1);

  const instance = instances[0];
  if (!instance) {
    throw new Error("No stopped instance to start");
  }

  // Update to provisioning state (transitional "starting" state)
  await db
    .update(agentInstances)
    .set({ status: "provisioning", updatedAt: new Date() })
    .where(eq(agentInstances.id, instance.id));

  try {
    // Power on the server
    if (!instance.serverId) {
      throw new Error("Instance has no server ID");
    }
    await powerOnServer(parseInt(instance.serverId));

    // Update to running state
    await db
      .update(agentInstances)
      .set({
        status: "running",
        startedAt: new Date(),
        stoppedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(agentInstances.id, instance.id));

    // Update agent status to active
    await db
      .update(agents)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(agents.id, agentId));

    console.log(`[Lifecycle] Agent ${agentId} started successfully`);
  } catch (error) {
    // Rollback to stopped state on failure
    await db
      .update(agentInstances)
      .set({ status: "stopped", updatedAt: new Date() })
      .where(eq(agentInstances.id, instance.id));

    throw error;
  }
}

/**
 * Destroy an agent instance
 * Deletes Hetzner server, Tailscale device, and updates database state
 * All cleanup operations are idempotent (404 = success)
 * @param agentId - The agent ID to destroy
 */
export async function destroyAgent(agentId: string): Promise<void> {
  // Query for instance (any status)
  const instances = await db
    .select()
    .from(agentInstances)
    .where(eq(agentInstances.agentId, agentId))
    .limit(1);

  const instance = instances[0];
  if (!instance) {
    console.log(`[Lifecycle] No instance found for agent ${agentId}, nothing to cleanup`);
    return;
  }

  // Update to stopping state
  await db
    .update(agentInstances)
    .set({ status: "stopping", updatedAt: new Date() })
    .where(eq(agentInstances.id, instance.id));

  // Delete Hetzner server (idempotent)
  if (instance.serverId) {
    try {
      await deleteServer(parseInt(instance.serverId));
    } catch (error) {
      console.error(
        `[Lifecycle] Failed to delete Hetzner server ${instance.serverId}:`,
        error
      );
      // Continue with cleanup
    }
  }

  // Delete Tailscale device (idempotent)
  if (instance.tailscaleIp) {
    try {
      const device = await findDeviceByIp(instance.tailscaleIp);
      if (device) {
        await deleteDevice(device.id);
      }
    } catch (error) {
      console.error(
        `[Lifecycle] Failed to delete Tailscale device for IP ${instance.tailscaleIp}:`,
        error
      );
      // Continue with cleanup
    }
  }

  // Update instance to stopped with error message
  await db
    .update(agentInstances)
    .set({
      status: "stopped",
      error: "Destroyed via lifecycle management",
      updatedAt: new Date(),
    })
    .where(eq(agentInstances.id, instance.id));

  // Update agent status to paused
  await db
    .update(agents)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(agents.id, agentId));

  console.log(`[Lifecycle] Agent ${agentId} destroyed successfully`);
}

/**
 * Rollback a failed provision by cleaning up orphaned resources
 * Idempotent cleanup of Hetzner VM and Tailscale device
 * @param jobId - The provisioning job ID to rollback
 * @throws Error if job not found
 */
export async function rollbackFailedProvision(jobId: string): Promise<void> {
  // Query provisioning job
  const jobs = await db
    .select()
    .from(provisioningJobs)
    .where(eq(provisioningJobs.id, jobId))
    .limit(1);

  const job = jobs[0];
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  // Query agent instance
  const instances = await db
    .select()
    .from(agentInstances)
    .where(eq(agentInstances.agentId, job.agentId))
    .limit(1);

  const instance = instances[0];
  if (!instance || !instance.serverId) {
    console.log(`[Lifecycle] No VM to clean up for job ${jobId}`);
    return;
  }

  // Track cleanup results
  let cleanedHetzner = false;
  let cleanedTailscale = false;

  // Delete Hetzner server
  try {
    await deleteServer(parseInt(instance.serverId));
    cleanedHetzner = true;
  } catch (error) {
    console.error(
      `[Lifecycle] Failed to delete Hetzner server ${instance.serverId}:`,
      error
    );
  }

  // Delete Tailscale device if it exists
  if (instance.tailscaleIp) {
    try {
      const device = await findDeviceByIp(instance.tailscaleIp);
      if (device) {
        await deleteDevice(device.id);
        cleanedTailscale = true;
      }
    } catch (error) {
      console.error(
        `[Lifecycle] Failed to delete Tailscale device for IP ${instance.tailscaleIp}:`,
        error
      );
    }
  }

  // Update instance status to failed with cleanup details
  await db
    .update(agentInstances)
    .set({
      status: "failed",
      error: `Rolled back after provision failure. Cleaned: Hetzner=${cleanedHetzner}, Tailscale=${cleanedTailscale}`,
      updatedAt: new Date(),
    })
    .where(eq(agentInstances.id, instance.id));

  // Update agent status to error
  await db
    .update(agents)
    .set({ status: "error", updatedAt: new Date() })
    .where(eq(agents.id, job.agentId));

  console.log(`[Lifecycle] Cleanup complete for job ${jobId}`);
}
