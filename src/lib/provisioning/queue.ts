import { db } from "@/lib/db";
import { provisioningJobs } from "@/lib/db/schema";
import { eq, and, or, desc, inArray } from "drizzle-orm";

// Heartbeat interval: 60 seconds (GitHub Actions posts heartbeat every 60s)
export const HEARTBEAT_INTERVAL_SECONDS = 60;
// Job timeout: 15 minutes (conservative — VM creation ~2-3min + Ansible ~3-5min + buffer)
export const JOB_TIMEOUT_SECONDS = 900;
// Max retries before requiring support intervention
export const MAX_RETRIES = 3;

type JobStatus = "queued" | "provisioning" | "running" | "failed";

interface EnqueueParams {
  agentId: string;
  userId: string;
  stripeEventId: string;
  region?: string;
}

interface UpdateJobStatusParams {
  jobId: string;
  status: JobStatus;
  workflowRunId?: string;
  error?: string;
  failedStep?: string;
}

/**
 * Enqueue a new provisioning job
 * Throws if user already has a job in progress
 */
export async function enqueueProvisioningJob(
  params: EnqueueParams
): Promise<typeof provisioningJobs.$inferSelect> {
  const { agentId, userId, stripeEventId, region = "us-east" } = params;

  console.log(`[Queue] Enqueuing provisioning job for agent ${agentId}`);

  // Check for concurrent provisioning jobs
  await checkConcurrentProvision(userId);

  // Insert new job
  const [job] = await db
    .insert(provisioningJobs)
    .values({
      agentId,
      userId,
      stripeEventId,
      region,
      status: "queued",
      retryCount: 0,
    })
    .returning();

  console.log(`[Queue] Job ${job.id} enqueued with status: queued`);

  return job;
}

/**
 * Check if user has any in-progress provisioning jobs
 * Throws if a concurrent job is found
 */
export async function checkConcurrentProvision(userId: string): Promise<void> {
  const inProgressJobs = await db
    .select()
    .from(provisioningJobs)
    .where(
      and(
        eq(provisioningJobs.userId, userId),
        inArray(provisioningJobs.status, ["queued", "provisioning"])
      )
    )
    .limit(1);

  if (inProgressJobs.length > 0) {
    console.log(
      `[Queue] Concurrent provision blocked for user ${userId}: job ${inProgressJobs[0].id} in progress`
    );
    throw new Error(
      "A provisioning job is already in progress. Please wait for it to complete."
    );
  }
}

/**
 * Update job status with optional metadata
 */
export async function updateJobStatus(
  params: UpdateJobStatusParams
): Promise<typeof provisioningJobs.$inferSelect> {
  const { jobId, status, workflowRunId, error, failedStep } = params;

  console.log(`[Queue] Updating job ${jobId} to status: ${status}`);

  const updates: Partial<typeof provisioningJobs.$inferInsert> = {
    status,
    updatedAt: new Date(),
  };

  // Set claimedAt when transitioning to provisioning
  if (status === "provisioning") {
    updates.claimedAt = new Date();
  }

  // Set completedAt for terminal states
  if (status === "running" || status === "failed") {
    updates.completedAt = new Date();
  }

  // Include optional fields
  if (workflowRunId !== undefined) {
    updates.workflowRunId = workflowRunId;
  }
  if (error !== undefined) {
    updates.error = error;
  }
  if (failedStep !== undefined) {
    updates.failedStep = failedStep;
  }

  const [job] = await db
    .update(provisioningJobs)
    .set(updates)
    .where(eq(provisioningJobs.id, jobId))
    .returning();

  console.log(`[Queue] Job ${jobId} updated successfully`);

  return job;
}

/**
 * Record heartbeat for an active provisioning job
 */
export async function recordHeartbeat(jobId: string): Promise<void> {
  console.log(`[Queue] Recording heartbeat for job ${jobId}`);

  await db
    .update(provisioningJobs)
    .set({
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(provisioningJobs.id, jobId),
        eq(provisioningJobs.status, "provisioning")
      )
    );
}

/**
 * Check if job has timed out based on heartbeat
 * Returns true if job was timed out and marked as failed
 */
export async function checkJobTimeout(jobId: string): Promise<boolean> {
  const [job] = await db
    .select()
    .from(provisioningJobs)
    .where(eq(provisioningJobs.id, jobId))
    .limit(1);

  if (!job || job.status !== "provisioning") {
    return false;
  }

  // Determine reference timestamp for timeout calculation
  const referenceTime =
    job.lastHeartbeatAt || job.claimedAt || job.updatedAt;
  const now = new Date();
  const elapsedSeconds = Math.floor(
    (now.getTime() - referenceTime.getTime()) / 1000
  );

  if (elapsedSeconds > JOB_TIMEOUT_SECONDS) {
    console.log(
      `[Queue] Job ${jobId} timed out after ${elapsedSeconds}s (threshold: ${JOB_TIMEOUT_SECONDS}s)`
    );

    await db
      .update(provisioningJobs)
      .set({
        status: "failed",
        error: `Timeout: No heartbeat for ${elapsedSeconds}s`,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(provisioningJobs.id, jobId));

    return true;
  }

  return false;
}

/**
 * Get job by Stripe event ID (for idempotency)
 */
export async function getJobByStripeEventId(
  stripeEventId: string
): Promise<typeof provisioningJobs.$inferSelect | undefined> {
  const [job] = await db
    .select()
    .from(provisioningJobs)
    .where(eq(provisioningJobs.stripeEventId, stripeEventId))
    .limit(1);

  return job;
}

/**
 * Get most recent job for an agent
 */
export async function getJobByAgentId(
  agentId: string
): Promise<typeof provisioningJobs.$inferSelect | undefined> {
  const [job] = await db
    .select()
    .from(provisioningJobs)
    .where(eq(provisioningJobs.agentId, agentId))
    .orderBy(desc(provisioningJobs.createdAt))
    .limit(1);

  return job;
}
