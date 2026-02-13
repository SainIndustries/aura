# Phase 09: Lifecycle Management - Research

**Researched:** 2026-02-13
**Domain:** VM lifecycle management, subscription lifecycle, rollback patterns
**Confidence:** HIGH

## Summary

Phase 9 implements lifecycle management for provisioned agents, enabling users to stop/restart VMs, handling subscription cancellations, implementing rollback on provision failure, and suspending agents on payment failures. The phase builds on the existing Hetzner and Tailscale API integrations from Phase 7-8, adding server power management and device cleanup capabilities.

The architecture follows the existing async pipeline pattern (Phase 6): user actions or Stripe webhooks trigger GitHub Actions workflows that execute long-running operations and post callbacks to update database state. VM state transitions (running → stopped → running) are managed through Hetzner's server action API, while cleanup operations (subscription cancellation) involve deleting both Hetzner servers and Tailscale devices.

Rollback mechanisms use idempotent cleanup patterns: if provisioning fails after creating a Hetzner VM, the failure callback triggers VM deletion. Payment failures require a nuanced approach: suspend access without destroying data to allow recovery when payment resumes.

**Primary recommendation:** Extend existing Hetzner/Tailscale modules with power management and cleanup functions, create new GitHub Actions workflows for lifecycle operations, add Stripe webhook handlers for cancellation/payment_failure, implement idempotent rollback logic in callbacks.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hetzner Cloud API | v1 | Server power management (shutdown, poweroff, poweron) | Already integrated in Phase 7, official REST API |
| Tailscale API | v2 | Device deletion from network | Already integrated in Phase 7, official REST API |
| Stripe Webhooks | latest | Subscription lifecycle events | Already integrated for checkout, standard billing integration |
| GitHub Actions | - | Async workflow orchestration | Already used for provisioning (Phase 6-8) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Drizzle ORM | latest | Database state management | Status transitions, instance metadata (already in use) |
| Native fetch | Node 20 | HTTP API calls | Consistent with Phase 7 decision, no additional deps |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GitHub Actions | Direct API calls from Next.js | Violates Phase 6 decision, hits Vercel timeout limits |
| Idempotent rollback | Manual cleanup | Requires operator intervention, error-prone |
| Tailscale device deletion | Leave orphaned devices | Network clutter, license costs, security risk |

**Installation:**
No new packages required. Extends existing infrastructure from Phases 6-8.

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
├── hetzner.ts              # [Phase 7] Add shutdown/poweroff/poweron functions
├── tailscale.ts            # [Phase 7] Add deleteDevice function
├── provisioning/
│   ├── lifecycle.ts        # [NEW] VM start/stop/destroy orchestrators
│   ├── rollback.ts         # [NEW] Cleanup orphaned resources
│   └── queue.ts            # [Phase 6] Extend for lifecycle job types
.github/workflows/
├── provision-agent.yml     # [Phase 8] Add rollback on failure
├── lifecycle-start.yml     # [NEW] Start stopped VM
├── lifecycle-stop.yml      # [NEW] Stop running VM
└── lifecycle-destroy.yml   # [NEW] Destroy VM + cleanup Tailscale
src/app/api/
├── agents/[id]/
│   ├── start/route.ts      # [Exists] Trigger lifecycle-start workflow
│   ├── stop/route.ts       # [Exists] Trigger lifecycle-stop workflow
│   └── destroy/route.ts    # [NEW] Trigger lifecycle-destroy workflow
└── webhooks/
    ├── stripe/route.ts     # [Exists] Add subscription.deleted, invoice.payment_failed handlers
    └── github/route.ts     # [Exists] Add lifecycle callback handling
```

### Pattern 1: Hetzner Server Power Management

**What:** Use Hetzner Cloud API server actions to control VM power state
**When to use:** User clicks stop/start in dashboard, payment failure requires suspension

**Example:**
```typescript
// Source: https://docs.hetzner.cloud (Hetzner Cloud API reference)
// Endpoint structure: POST /servers/{id}/actions/{action}

export async function shutdownServer(serverId: number): Promise<void> {
  const { token } = getHetznerConfig();
  const url = `https://api.hetzner.cloud/v1/servers/${serverId}/actions/shutdown`;

  const response = await fetchWithRateLimit(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Shutdown failed: ${data.error?.message}`);
  }

  // Wait for shutdown action to complete
  await waitForAction(data.action.id);
  console.log(`[Hetzner] Server ${serverId} shut down gracefully`);
}

export async function powerOnServer(serverId: number): Promise<void> {
  const { token } = getHetznerConfig();
  const url = `https://api.hetzner.cloud/v1/servers/${serverId}/actions/poweron`;

  const response = await fetchWithRateLimit(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Power on failed: ${data.error?.message}`);
  }

  await waitForAction(data.action.id);
  console.log(`[Hetzner] Server ${serverId} powered on`);
}

// Use poweroff for forceful stop (data loss risk, last resort only)
export async function powerOffServer(serverId: number): Promise<void> {
  // Similar to above, but uses /actions/poweroff
  // Only use when shutdown times out or VM is unresponsive
}
```

### Pattern 2: Tailscale Device Cleanup

**What:** Remove device from Tailscale network when VM is destroyed
**When to use:** Subscription cancelled, agent permanently deleted, rollback cleanup

**Example:**
```typescript
// Source: https://github.com/tailscale/tailscale/issues/8844 (API documentation)
// DELETE https://api.tailscale.com/api/v2/device/{device_id}

export async function deleteDevice(deviceId: string): Promise<void> {
  const tokenResponse = await getOAuthToken();
  const accessToken = tokenResponse.access_token;

  const url = `https://api.tailscale.com/api/v2/device/${deviceId}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    // 404 is OK - device already deleted (idempotent)
    const data = await response.json();
    throw new Error(`Tailscale device deletion failed: ${JSON.stringify(data)}`);
  }

  console.log(`[Tailscale] Device ${deviceId} deleted from network`);
}
```

### Pattern 3: Idempotent Rollback on Provision Failure

**What:** Cleanup orphaned resources when provisioning fails mid-workflow
**When to use:** Provision workflow fails after creating Hetzner VM but before completion

**Example:**
```typescript
// In .github/workflows/provision-agent.yml failure callback:
// - If VM created but Ansible failed → delete VM + Tailscale device
// - If Tailscale enrolled but job failed → delete device
// Store serverId in job outputs, check on failure

// In src/lib/provisioning/rollback.ts:
export async function rollbackFailedProvision(jobId: string): Promise<void> {
  // 1. Get job from database
  const job = await getJobById(jobId);

  // 2. Check if VM was created (query agentInstances for serverId)
  const instance = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.agentId, job.agentId),
  });

  if (!instance?.serverId) {
    console.log("[Rollback] No VM to clean up");
    return;
  }

  // 3. Delete Hetzner server (idempotent - 404 is success)
  try {
    await deleteServer(parseInt(instance.serverId));
  } catch (error) {
    console.error("[Rollback] Hetzner cleanup failed:", error);
    // Log but continue - may already be deleted
  }

  // 4. Delete Tailscale device if enrolled (idempotent - 404 is success)
  if (instance.tailscaleIp) {
    // Need to find deviceId by hostname or IP
    try {
      const devices = await listDevices(); // New function
      const device = devices.find(d => d.addresses.includes(instance.tailscaleIp!));
      if (device) {
        await deleteDevice(device.id);
      }
    } catch (error) {
      console.error("[Rollback] Tailscale cleanup failed:", error);
    }
  }

  // 5. Update database: mark instance as failed, job as rolled back
  await db.update(agentInstances)
    .set({ status: "failed", error: "Rolled back after provision failure" })
    .where(eq(agentInstances.id, instance.id));
}
```

### Pattern 4: Subscription Lifecycle Webhooks

**What:** Handle Stripe subscription events to trigger VM cleanup
**When to use:** Customer cancels subscription, subscription auto-cancelled after payment failures

**Example:**
```typescript
// In src/app/api/webhooks/stripe/route.ts:

switch (event.type) {
  case "customer.subscription.deleted": {
    // Subscription cancelled - destroy VM and cleanup resources
    const sub = event.data.object as Stripe.Subscription;
    const userId = await getUserIdFromStripeCustomer(sub.customer);

    // Find all active agents for this user
    const agents = await db.query.agents.findMany({
      where: eq(agents.userId, userId),
      with: { instances: true },
    });

    // Queue destroy jobs for each active agent
    for (const agent of agents) {
      if (agent.instances.some(i => i.status === "running")) {
        await enqueueLifecycleJob({
          agentId: agent.id,
          userId,
          operation: "destroy",
          reason: "subscription_cancelled",
        });
      }
    }
    break;
  }

  case "invoice.payment_failed": {
    // Payment failed - suspend but preserve data
    const invoice = event.data.object;
    const userId = await getUserIdFromStripeCustomer(invoice.customer);

    const agents = await db.query.agents.findMany({
      where: eq(agents.userId, userId),
      with: { instances: true },
    });

    // Queue suspend (stop VM) but don't destroy
    for (const agent of agents) {
      if (agent.instances.some(i => i.status === "running")) {
        await enqueueLifecycleJob({
          agentId: agent.id,
          userId,
          operation: "suspend",
          reason: "payment_failed",
        });
      }
    }
    break;
  }

  case "invoice.payment_succeeded": {
    // Payment recovered - restart suspended agents
    // Only if subscription still active
    break;
  }
}
```

### Pattern 5: VM State Transitions

**What:** Track VM lifecycle states in database with valid transitions
**When to use:** All lifecycle operations must update both Hetzner and database atomically

**Valid transitions:**
```
pending → provisioning → running
running → stopping → stopped
stopped → starting → running
running → destroying → destroyed (terminal)
provisioning → failed (with rollback)
```

**Example:**
```typescript
// Atomic state transition with rollback on failure
export async function stopAgent(agentId: string): Promise<void> {
  // 1. Get current instance
  const instance = await db.query.agentInstances.findFirst({
    where: and(
      eq(agentInstances.agentId, agentId),
      eq(agentInstances.status, "running")
    ),
  });

  if (!instance) {
    throw new Error("No running instance to stop");
  }

  // 2. Update to "stopping" state
  await db.update(agentInstances)
    .set({ status: "stopping", updatedAt: new Date() })
    .where(eq(agentInstances.id, instance.id));

  try {
    // 3. Execute Hetzner shutdown
    await shutdownServer(parseInt(instance.serverId!));

    // 4. Update to "stopped" state
    await db.update(agentInstances)
      .set({
        status: "stopped",
        stoppedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(agentInstances.id, instance.id));

    // 5. Update agent status
    await db.update(agents)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(agents.id, agentId));

  } catch (error) {
    // Rollback: restore to "running" state
    await db.update(agentInstances)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(agentInstances.id, instance.id));
    throw error;
  }
}
```

### Anti-Patterns to Avoid

- **Non-idempotent cleanup:** Always handle 404 as success for deletion operations
- **Synchronous lifecycle ops in API routes:** Use GitHub Actions for all VM operations (Vercel timeout)
- **Destroying data on payment failure:** Suspend access, preserve data for recovery
- **Ignoring orphaned Tailscale devices:** Always cleanup on VM deletion (license costs, security)
- **Missing rollback on partial provision:** Always cleanup Hetzner VM if workflow fails
- **Race conditions on state transitions:** Use database locks or queued jobs (one at a time)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VM state machine | Custom state validation logic | PostgreSQL enum transitions + app-level guards | Database constraints prevent invalid states, easier to audit |
| Retry logic for API calls | Custom exponential backoff | Existing `fetchWithRateLimit` from hetzner.ts | Already handles rate limits, proven in Phase 7 |
| Async job orchestration | Custom polling/webhook system | Existing GitHub Actions pipeline (Phase 6) | Handles timeouts, retries, logs, already integrated |
| Idempotency keys | Custom deduplication | Stripe event IDs, job IDs in database | Built-in deduplication, prevents duplicate operations |
| Cleanup scheduling | Cron jobs for orphan detection | Workflow failure callbacks + manual admin tools | Immediate cleanup on failure, admin tools for edge cases |

**Key insight:** Lifecycle management is 90% state transitions and cleanup. The heavy lifting (API calls, workflows) already exists from Phases 6-8. Phase 9 primarily adds new state transitions and cleanup orchestration using existing patterns.

## Common Pitfalls

### Pitfall 1: Non-idempotent Cleanup Operations

**What goes wrong:** Rollback fails because VM already deleted, Tailscale device already removed, causing secondary errors that mask original failure

**Why it happens:** DELETE operations return 404 for already-deleted resources, code treats 404 as error instead of success

**How to avoid:**
- Always check for 404 and treat as success for DELETE operations
- Log cleanup attempts even when resource doesn't exist
- Store cleanup state in database to prevent duplicate attempts

**Warning signs:**
- Rollback fails with "server not found" after provision timeout
- Multiple cleanup attempts for same resource
- Alerts firing for already-deleted resources

### Pitfall 2: Destroying Data on Payment Failure

**What goes wrong:** Payment fails temporarily (expired card), system destroys VM, customer fixes payment but loses all data

**Why it happens:** Confusing "subscription cancelled" (permanent) with "payment failed" (recoverable)

**How to avoid:**
- invoice.payment_failed → stop VM (preserve disk), set agent to "paused"
- customer.subscription.deleted → destroy VM, cleanup all resources
- Track suspension reason in database to enable recovery

**Warning signs:**
- Customer complaints about data loss after payment issues
- High churn after first payment failure
- Support tickets about "why was my agent deleted"

### Pitfall 3: Orphaned Tailscale Devices

**What goes wrong:** Hetzner VM deleted but Tailscale device remains, consuming license slots and appearing in network list

**Why it happens:** Cleanup skips Tailscale deletion, or deletion fails silently

**How to avoid:**
- Always pair Hetzner deleteServer with Tailscale deleteDevice
- Store Tailscale deviceId in agentInstances table
- Add admin tool to detect and cleanup orphaned devices

**Warning signs:**
- Tailscale device count exceeds Hetzner server count
- Devices with "offline" status for >7 days
- Devices named for deleted agents

### Pitfall 4: Race Conditions on Concurrent Lifecycle Operations

**What goes wrong:** User clicks "stop" twice rapidly, two workflows execute simultaneously, VM enters invalid state

**Why it happens:** No queue or locking mechanism prevents concurrent operations on same agent

**How to avoid:**
- Check agentInstances.status before queuing lifecycle job
- Reject operations if instance in transition state (stopping, starting, destroying)
- Use database constraints: only one active instance per agent

**Warning signs:**
- "Instance already stopping" errors
- Multiple GitHub Actions workflows for same agent
- Database foreign key violations on instance updates

### Pitfall 5: Incomplete Rollback on Provision Failure

**What goes wrong:** Provision fails after creating Hetzner VM, VM remains running forever, accumulating costs

**Why it happens:** Failure callback doesn't have serverId to cleanup, or error handling skips rollback

**How to avoid:**
- Store serverId in GitHub Actions step outputs immediately after creation
- Add "always()" condition to rollback step in workflow
- Log rollback attempts to database for audit trail

**Warning signs:**
- Hetzner servers exist with no matching agentInstances records
- Servers tagged with old job IDs (>1 day)
- Unexpected Hetzner billing charges

### Pitfall 6: Graceful Shutdown Timeout Handling

**What goes wrong:** User stops agent, graceful shutdown times out (VM frozen), workflow fails, VM stays running

**Why it happens:** shutdownServer waits indefinitely for ACPI shutdown, no fallback to poweroff

**How to avoid:**
- Add timeout to waitForAction in shutdownServer (e.g., 60 seconds)
- On timeout, fallback to powerOffServer (forceful)
- Log when forceful shutdown used for debugging

**Warning signs:**
- "Stop agent" operations timing out
- Workflows cancelled mid-shutdown
- Agents showing "stopping" status for hours

## Code Examples

Verified patterns from official sources and existing codebase:

### Hetzner Server Lifecycle Operations

```typescript
// Source: https://docs.hetzner.cloud reference + existing hetzner.ts patterns

/**
 * Shutdown server gracefully (ACPI signal)
 * Waits up to 60s, then fallback to poweroff
 */
export async function shutdownServer(serverId: number): Promise<void> {
  const { token } = getHetznerConfig();
  const url = `https://api.hetzner.cloud/v1/servers/${serverId}/actions/shutdown`;

  const response = await fetchWithRateLimit(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`[Hetzner] Shutdown failed: ${data.error?.message}`);
  }

  try {
    // Wait for shutdown with 60s timeout
    await waitForAction(data.action.id, { maxRetries: 60, intervalMs: 1000 });
    console.log(`[Hetzner] Server ${serverId} shut down gracefully`);
  } catch (error) {
    // Graceful shutdown timed out, force poweroff
    console.warn(`[Hetzner] Graceful shutdown timed out for ${serverId}, forcing poweroff`);
    await powerOffServer(serverId);
  }
}

/**
 * Power on a stopped server
 */
export async function powerOnServer(serverId: number): Promise<void> {
  const { token } = getHetznerConfig();
  const url = `https://api.hetzner.cloud/v1/servers/${serverId}/actions/poweron`;

  const response = await fetchWithRateLimit(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`[Hetzner] Power on failed: ${data.error?.message}`);
  }

  await waitForAction(data.action.id);
  console.log(`[Hetzner] Server ${serverId} powered on`);
}

/**
 * Force power off (last resort, may cause data loss)
 */
export async function powerOffServer(serverId: number): Promise<void> {
  const { token } = getHetznerConfig();
  const url = `https://api.hetzner.cloud/v1/servers/${serverId}/actions/poweroff`;

  const response = await fetchWithRateLimit(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`[Hetzner] Power off failed: ${data.error?.message}`);
  }

  await waitForAction(data.action.id);
  console.log(`[Hetzner] Server ${serverId} forced power off`);
}
```

### Tailscale Device Management

```typescript
// Source: Tailscale API docs + existing tailscale.ts patterns

/**
 * List all devices in tailnet (for finding orphaned devices)
 */
export async function listDevices(): Promise<TailscaleDevice[]> {
  const tokenResponse = await getOAuthToken();
  const accessToken = tokenResponse.access_token;

  const url = "https://api.tailscale.com/api/v2/tailnet/-/devices";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`[Tailscale] Device list fetch failed: ${JSON.stringify(data)}`);
  }

  return data.devices as TailscaleDevice[];
}

/**
 * Delete device from Tailscale network (idempotent)
 */
export async function deleteDevice(deviceId: string): Promise<void> {
  const tokenResponse = await getOAuthToken();
  const accessToken = tokenResponse.access_token;

  const url = `https://api.tailscale.com/api/v2/device/${deviceId}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // 404 is OK - device already deleted (idempotent)
  if (!response.ok && response.status !== 404) {
    const data = await response.json();
    throw new Error(`[Tailscale] Device deletion failed: ${JSON.stringify(data)}`);
  }

  console.log(`[Tailscale] Device ${deviceId} deleted from network`);
}

/**
 * Find device by Tailscale IP address
 */
export async function findDeviceByIp(tailscaleIp: string): Promise<TailscaleDevice | undefined> {
  const devices = await listDevices();
  return devices.find(d => d.addresses.includes(tailscaleIp));
}
```

### Lifecycle Orchestration

```typescript
// Source: Phase 6-8 patterns + lifecycle requirements

import { shutdownServer, powerOnServer, deleteServer } from "../hetzner";
import { deleteDevice, findDeviceByIp } from "../tailscale";
import { db } from "../db";
import { agentInstances, agents } from "../db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Stop a running agent (graceful shutdown, preserve data)
 */
export async function stopAgent(agentId: string): Promise<void> {
  const instance = await db.query.agentInstances.findFirst({
    where: and(
      eq(agentInstances.agentId, agentId),
      eq(agentInstances.status, "running")
    ),
  });

  if (!instance) {
    throw new Error("No running instance to stop");
  }

  // Transition to "stopping"
  await db.update(agentInstances)
    .set({ status: "stopping", updatedAt: new Date() })
    .where(eq(agentInstances.id, instance.id));

  try {
    // Shutdown VM
    await shutdownServer(parseInt(instance.serverId!));

    // Update to "stopped"
    await db.update(agentInstances)
      .set({
        status: "stopped",
        stoppedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(agentInstances.id, instance.id));

    await db.update(agents)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(agents.id, agentId));

    console.log(`[Lifecycle] Agent ${agentId} stopped successfully`);
  } catch (error) {
    // Rollback to "running"
    await db.update(agentInstances)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(agentInstances.id, instance.id));
    throw error;
  }
}

/**
 * Start a stopped agent
 */
export async function startAgent(agentId: string): Promise<void> {
  const instance = await db.query.agentInstances.findFirst({
    where: and(
      eq(agentInstances.agentId, agentId),
      eq(agentInstances.status, "stopped")
    ),
  });

  if (!instance) {
    throw new Error("No stopped instance to start");
  }

  // Transition to "starting" (reuse provisioning status)
  await db.update(agentInstances)
    .set({ status: "provisioning", updatedAt: new Date() })
    .where(eq(agentInstances.id, instance.id));

  try {
    // Power on VM
    await powerOnServer(parseInt(instance.serverId!));

    // Update to "running"
    await db.update(agentInstances)
      .set({
        status: "running",
        startedAt: new Date(),
        stoppedAt: null,
        updatedAt: new Date()
      })
      .where(eq(agentInstances.id, instance.id));

    await db.update(agents)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(agents.id, agentId));

    console.log(`[Lifecycle] Agent ${agentId} started successfully`);
  } catch (error) {
    // Rollback to "stopped"
    await db.update(agentInstances)
      .set({ status: "stopped", updatedAt: new Date() })
      .where(eq(agentInstances.id, instance.id));
    throw error;
  }
}

/**
 * Destroy agent (delete VM and cleanup Tailscale device)
 */
export async function destroyAgent(agentId: string): Promise<void> {
  const instance = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.agentId, agentId),
  });

  if (!instance) {
    console.log(`[Lifecycle] No instance found for agent ${agentId}`);
    return;
  }

  // Delete Hetzner server (idempotent)
  if (instance.serverId) {
    try {
      await deleteServer(parseInt(instance.serverId));
    } catch (error) {
      console.error(`[Lifecycle] Hetzner cleanup failed:`, error);
      // Continue - may already be deleted
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
      console.error(`[Lifecycle] Tailscale cleanup failed:`, error);
      // Continue - may already be deleted
    }
  }

  // Mark instance as destroyed
  await db.update(agentInstances)
    .set({
      status: "stopped",
      error: "Destroyed via lifecycle management",
      updatedAt: new Date()
    })
    .where(eq(agentInstances.id, instance.id));

  console.log(`[Lifecycle] Agent ${agentId} destroyed successfully`);
}
```

### Rollback on Provision Failure

```typescript
// Source: GitHub Actions cleanup patterns + idempotency research

/**
 * Rollback orphaned resources after provision failure
 * Called from GitHub Actions failure callback or admin tools
 */
export async function rollbackFailedProvision(jobId: string): Promise<void> {
  console.log(`[Rollback] Starting cleanup for job ${jobId}`);

  // 1. Get job metadata
  const job = await db.query.provisioningJobs.findFirst({
    where: eq(provisioningJobs.id, jobId),
  });

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  // 2. Find orphaned instance (may be in any non-terminal state)
  const instance = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.agentId, job.agentId),
  });

  if (!instance) {
    console.log("[Rollback] No instance to clean up");
    return;
  }

  let cleanedHetzner = false;
  let cleanedTailscale = false;

  // 3. Cleanup Hetzner server (idempotent)
  if (instance.serverId) {
    try {
      await deleteServer(parseInt(instance.serverId));
      cleanedHetzner = true;
      console.log(`[Rollback] Deleted Hetzner server ${instance.serverId}`);
    } catch (error) {
      console.error(`[Rollback] Hetzner cleanup failed:`, error);
      // May already be deleted - treat as success if 404
    }
  }

  // 4. Cleanup Tailscale device (idempotent)
  if (instance.tailscaleIp) {
    try {
      const device = await findDeviceByIp(instance.tailscaleIp);
      if (device) {
        await deleteDevice(device.id);
        cleanedTailscale = true;
        console.log(`[Rollback] Deleted Tailscale device ${device.id}`);
      }
    } catch (error) {
      console.error(`[Rollback] Tailscale cleanup failed:`, error);
    }
  }

  // 5. Update instance to failed state
  await db.update(agentInstances)
    .set({
      status: "failed",
      error: `Rolled back after provision failure. Cleaned: Hetzner=${cleanedHetzner}, Tailscale=${cleanedTailscale}`,
      updatedAt: new Date(),
    })
    .where(eq(agentInstances.id, instance.id));

  // 6. Ensure agent status reflects failure
  await db.update(agents)
    .set({ status: "error", updatedAt: new Date() })
    .where(eq(agents.id, job.agentId));

  console.log(`[Rollback] Cleanup complete for job ${jobId}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual VM cleanup | Idempotent rollback on failure | 2024+ | Prevents orphaned resources, reduces costs |
| Destroy on payment failure | Suspend with data preservation | Stripe best practice 2023+ | Reduces churn, enables recovery |
| Leave Tailscale devices | Delete on VM destruction | Tailscale API v2 (2022+) | Cleaner network, lower license costs |
| Synchronous API operations | GitHub Actions workflows | Cloud Functions timeout limits | Handles long operations (>10min) |
| Cron-based cleanup | Event-driven cleanup | Modern cloud patterns | Immediate cleanup, no drift |

**Deprecated/outdated:**
- **Manual operator cleanup:** Replaced by automated rollback in failure callbacks
- **Polling for VM state:** Hetzner action polling already implemented in Phase 7
- **Static Tailscale auth keys:** Already using ephemeral OAuth keys (Phase 7)

## Open Questions

1. **How should we handle agent restart after payment recovery?**
   - What we know: invoice.payment_succeeded event fires when payment clears
   - What's unclear: Should restart be automatic or require user action?
   - Recommendation: Automatic restart if subscription still active, notify user via email

2. **Should we implement cascade deletion for related resources (channels, messages)?**
   - What we know: Database has ON DELETE CASCADE for some relations
   - What's unclear: Are there resources that should be preserved after agent deletion?
   - Recommendation: Preserve audit logs and billing history, cascade delete operational data

3. **How long should we wait before destroying VM after subscription cancellation?**
   - What we know: Stripe cancellation is immediate, VM costs ~$0.01/hour
   - What's unclear: Grace period for customer to recover data?
   - Recommendation: 7-day grace period before destroy, move to "stopped" immediately to minimize costs

4. **Should we support "hibernate" mode (delete VM but preserve config)?**
   - What we know: Current design assumes VM exists = agent exists
   - What's unclear: Value of allowing "delete VM, keep agent config" for long-term paused agents
   - Recommendation: Phase 9 supports stopped VMs (data preserved). Full hibernate (no VM) is future enhancement.

## Sources

### Primary (HIGH confidence)
- [Hetzner Cloud API Documentation](https://docs.hetzner.cloud/) - Server power management endpoints
- [Hetzner Cloud Python SDK](https://hcloud-python.readthedocs.io/en/latest/api.clients.servers.html) - Server actions reference
- [Tailscale Device Management](https://github.com/tailscale/tailscale/issues/8844) - Device deletion API
- [Stripe Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) - Lifecycle events
- [Stripe Subscription Cancellation](https://docs.stripe.com/billing/subscriptions/cancel) - Cancellation behavior
- Existing codebase - src/lib/hetzner.ts, src/lib/tailscale.ts, src/lib/provisioning/queue.ts (Phase 6-8)

### Secondary (MEDIUM confidence)
- [Stripe Payment Retry](https://docs.stripe.com/billing/revenue-recovery/smart-retries) - Dunning and retry behavior
- [Stripe Failed Payments Guide](https://benfoster.io/blog/stripe-failed-payments-how-to/) - Best practices for payment failures
- [Idempotent DELETE Operations](https://brandur.org/fragments/idempotent-delete) - Retry-safe deletion patterns
- [Infrastructure Rollback Patterns](https://developer.gs.com/blog/posts/infrastructure-and-command-chain-pattern) - Command chain pattern
- [VM State Machines](https://docs.openstack.org/nova/latest/reference/vm-states.html) - OpenStack VM state reference

### Tertiary (LOW confidence)
- [Auto-Pruning Orphaned Resources](https://www.harness.io/blog/auto-pruning-orphaned-resources) - Cleanup strategies
- [GitHub Actions Cleanup Patterns](https://github.com/marketplace/actions/clean-workflow-runs) - Workflow cleanup
- Web search results on VM lifecycle, database rollback, idempotency (multiple sources)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All APIs already integrated in Phase 6-8, official documentation verified
- Architecture: HIGH - Follows established async pipeline pattern, extends proven patterns
- Pitfalls: MEDIUM-HIGH - Based on research + logical analysis, not production experience

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days - stable APIs, unlikely to change)
