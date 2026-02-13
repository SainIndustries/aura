---
phase: 06-async-pipeline-foundation
plan: 01
subsystem: database-queue
tags: [database, schema, job-queue, async-foundation]
dependency-graph:
  requires: []
  provides:
    - provisioningJobs table (job lifecycle tracking)
    - jobStatusEnum (queued, provisioning, running, failed)
    - Queue operations module (enqueue, status updates, timeout detection)
  affects:
    - Future webhook handlers (Plan 02, 03)
    - Future GitHub Actions workflows (Plan 02)
    - Agent provisioning API
tech-stack:
  added:
    - Drizzle ORM table: provisioningJobs
    - PostgreSQL enum: job_status
  patterns:
    - Atomic job status transitions with timestamp tracking
    - Concurrency control (one job per user)
    - Idempotency via stripeEventId unique constraint
    - Heartbeat-based timeout detection (15min threshold)
key-files:
  created:
    - src/lib/provisioning/queue.ts
    - drizzle/0003_solid_viper.sql
  modified:
    - src/lib/db/schema.ts
decisions:
  - Max retries set to 3 (conservative default)
  - Job timeout threshold: 900s (15 minutes)
  - Heartbeat interval: 60s (matches GitHub Actions default)
  - Region default: us-east (matches existing agentInstances)
  - Timeout detection: on-demand (called by dashboard, not background cron)
metrics:
  duration: 193s
  tasks-completed: 2
  commits: 2
  files-created: 2
  files-modified: 1
  completed-at: 2026-02-13
---

# Phase 6 Plan 01: Database Schema and Job Queue Operations Summary

**One-liner:** Created provisioningJobs table with job lifecycle tracking and queue operations module with atomic status updates, concurrency control, and heartbeat-based timeout detection.

## What Was Built

### 1. Database Schema (`src/lib/db/schema.ts`)

**jobStatusEnum:**
- Enum with 4 states: `queued`, `provisioning`, `running`, `failed`
- Represents the complete job lifecycle from creation to terminal state

**provisioningJobs Table:**
- **Job identity:** id, agentId, userId
- **Idempotency:** stripeEventId (unique constraint) prevents duplicate jobs on webhook retry
- **Job state:** status (jobStatusEnum), region, workflowRunId
- **Retry logic:** retryCount, maxRetries (default 3)
- **Error tracking:** error, failedStep
- **Lifecycle timestamps:** claimedAt, lastHeartbeatAt, completedAt, createdAt, updatedAt
- **Cascading deletes:** Foreign keys to agents and users with ON DELETE CASCADE

**Relations:**
- `provisioningJobs → agents` (many-to-one)
- `provisioningJobs → users` (many-to-one)
- `agents → provisioningJobs` (one-to-many)
- `users → provisioningJobs` (one-to-many)

**Migration:** Generated `drizzle/0003_solid_viper.sql` with CREATE TYPE and CREATE TABLE statements.

### 2. Queue Operations Module (`src/lib/provisioning/queue.ts`)

**Constants:**
- `HEARTBEAT_INTERVAL_SECONDS = 60` (GitHub Actions heartbeat frequency)
- `JOB_TIMEOUT_SECONDS = 900` (15-minute timeout threshold)
- `MAX_RETRIES = 3` (retry limit before manual intervention required)

**Exported Functions:**

1. **`enqueueProvisioningJob(params)`**
   - Creates new provisioning job with status "queued"
   - Checks for concurrent jobs (throws if user has in-progress job)
   - Returns inserted job row
   - Used by: Stripe webhook handler (Plan 02)

2. **`checkConcurrentProvision(userId)`**
   - Queries for jobs with status "queued" or "provisioning"
   - Throws error if concurrent job found
   - Enforces one-provision-at-a-time-per-user policy

3. **`updateJobStatus(params)`**
   - Updates job status with atomic timestamp management
   - Sets `claimedAt` when transitioning to "provisioning"
   - Sets `completedAt` for terminal states ("running", "failed")
   - Accepts optional metadata: workflowRunId, error, failedStep
   - Returns updated job row

4. **`recordHeartbeat(jobId)`**
   - Updates `lastHeartbeatAt` and `updatedAt` timestamps
   - Only updates jobs with status "provisioning"
   - Called by: GitHub Actions workflow (Plan 02)

5. **`checkJobTimeout(jobId)`**
   - Calculates elapsed time since last heartbeat/claim/update
   - If elapsed > 900s, marks job as failed with timeout error
   - Returns true if job was timed out
   - Called by: Dashboard status checks (future)

6. **`getJobByStripeEventId(stripeEventId)`**
   - Retrieves job by Stripe event ID for idempotency check
   - Returns undefined if not found
   - Used by: Stripe webhook handler (Plan 02)

7. **`getJobByAgentId(agentId)`**
   - Gets most recent job for agent (ordered by createdAt desc)
   - Returns undefined if no jobs found
   - Used by: Agent provisioning status UI

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions Made

1. **Max retries = 3:** Conservative default balancing automatic recovery vs. preventing infinite retry loops. Matches common industry practice for infrastructure operations.

2. **15-minute timeout threshold:** Accounts for:
   - Hetzner VM creation: 2-3 minutes
   - Ansible provisioning: 3-5 minutes
   - Network overhead and buffer: ~7-9 minutes
   - Conservative estimate to avoid false positives

3. **On-demand timeout detection:** `checkJobTimeout` is called by dashboard status checks rather than background cron. Simplifies implementation for v1.1 - no need for separate timeout worker process.

4. **Heartbeat interval = 60s:** Matches GitHub Actions default step timing. Provides sufficient granularity for 15-minute timeout while minimizing database writes.

5. **Region default = us-east:** Matches existing `agentInstances.region` default for consistency.

## Technical Notes

**Idempotency Strategy:**
- `stripeEventId` unique constraint ensures duplicate webhook events don't create multiple jobs
- Webhook handler will check `getJobByStripeEventId` before calling `enqueueProvisioningJob`

**Concurrency Control:**
- `checkConcurrentProvision` prevents race conditions by blocking new jobs when user has queued/provisioning job
- Query uses `inArray` for efficient status filtering
- Error message is user-facing: "A provisioning job is already in progress. Please wait for it to complete."

**Timestamp Management:**
- `claimedAt`: Set when job transitions to "provisioning" (GitHub Actions picks it up)
- `lastHeartbeatAt`: Updated every 60s by GitHub Actions workflow
- `completedAt`: Set when job reaches terminal state ("running" or "failed")
- Timeout calculation uses priority: `lastHeartbeatAt` > `claimedAt` > `updatedAt`

**Status Transitions:**
```
queued → provisioning → running  (success path)
                     → failed    (error path)
```

All transitions are atomic with automatic timestamp updates.

## Verification Results

**TypeScript Compilation:**
- ✅ `npx tsc --noEmit` passes with 0 non-test errors
- Pre-existing test errors unrelated to this plan

**Drizzle Migration:**
- ✅ Migration file generated: `drizzle/0003_solid_viper.sql`
- ✅ Contains CREATE TYPE for job_status enum
- ✅ Contains CREATE TABLE for provisioning_jobs with all columns
- ✅ Contains foreign key constraints with CASCADE delete

**Queue Module:**
- ✅ All 7 functions exported
- ✅ All 3 constants exported
- ✅ Uses `@/` path aliases correctly
- ✅ Follows existing codebase conventions (camelCase, console.log with prefix)

## Next Steps

**Immediate (Plan 02):**
- Enhance Stripe webhook handler to enqueue provisioning jobs
- Create GitHub Actions workflow to process queued jobs
- Implement callback webhook for workflow status updates

**Future:**
- Wire `getJobByAgentId` into provisioning status UI
- Add timeout detection to dashboard status polling
- Consider retry logic (increment retryCount on failure, re-enqueue if < maxRetries)

## Self-Check: PASSED

**Created files exist:**
- ✅ FOUND: src/lib/provisioning/queue.ts
- ✅ FOUND: drizzle/0003_solid_viper.sql

**Modified files exist:**
- ✅ FOUND: src/lib/db/schema.ts

**Commits exist:**
- ✅ FOUND: 7097b84 (Task 1: database schema)
- ✅ FOUND: b91e322 (Task 2: queue operations module)

**Database schema validation:**
- ✅ jobStatusEnum defined with 4 states
- ✅ provisioningJobs table has 16 columns
- ✅ stripeEventId has unique constraint
- ✅ Foreign keys to agents and users with CASCADE

**Queue module validation:**
- ✅ All 7 functions implemented and exported
- ✅ Constants exported (HEARTBEAT_INTERVAL_SECONDS, JOB_TIMEOUT_SECONDS, MAX_RETRIES)
- ✅ TypeScript types defined for params
- ✅ Proper error handling (concurrency check throws, timeout detection marks failed)
