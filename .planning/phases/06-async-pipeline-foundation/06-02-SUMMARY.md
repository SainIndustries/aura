---
phase: 06-async-pipeline-foundation
plan: 02
subsystem: webhook-integration
tags: [stripe, webhook, github-actions, workflow-dispatch, async-trigger]
dependency-graph:
  requires:
    - provisioningJobs table (Plan 01)
    - enqueueProvisioningJob function (Plan 01)
    - getJobByStripeEventId function (Plan 01)
  provides:
    - Stripe webhook integration with provisioning queue
    - GitHub Actions workflow_dispatch trigger
    - Idempotent job creation on checkout.session.completed
  affects:
    - Future GitHub Actions workflow (Plan 03 - will receive job_id, agent_id, region, callback_url)
    - Future callback webhook handler (Plan 03 - receives status updates)
    - Stripe checkout session creation (must include agentId, userId, region metadata)
tech-stack:
  added:
    - GitHub Actions workflow_dispatch API integration
    - Native fetch for HTTP requests (Node.js 18+)
  patterns:
    - Idempotent webhook processing via Stripe event ID
    - Non-blocking async trigger (job stays queued if trigger fails)
    - Nested try/catch for graceful degradation
    - Fast webhook response (<2s) with background processing
key-files:
  created:
    - src/lib/provisioning/github-actions.ts
  modified:
    - src/app/api/webhooks/stripe/route.ts
decisions:
  - GitHub Actions workflow filename: provision-agent.yml (hardcoded, standard naming)
  - Workflow ref: main (assumes primary branch, could parameterize in future)
  - Callback URL: ${appUrl}/api/webhooks/github (Plan 03 will implement)
  - Environment validation: Fail fast on missing env vars (clear error messages)
  - Non-blocking trigger: Workflow dispatch failures don't fail webhook (job stays queued for retry)
metrics:
  duration: 100s
  tasks-completed: 2
  commits: 2
  files-created: 1
  files-modified: 1
  completed-at: 2026-02-13
---

# Phase 6 Plan 02: Stripe Webhook Integration and GitHub Actions Trigger Summary

**One-liner:** Integrated Stripe checkout.session.completed webhook with provisioning queue and GitHub Actions workflow_dispatch trigger, enabling automatic job creation and workflow execution on payment completion.

## What Was Built

### 1. GitHub Actions Trigger Module (`src/lib/provisioning/github-actions.ts`)

**Environment Configuration Validation:**
- `getGitHubConfig()`: Validates 5 required environment variables
  - `GITHUB_PAT`: Fine-grained GitHub personal access token (Actions: write, Contents: read, Metadata: read)
  - `GITHUB_REPO_OWNER`: Repository owner (username or org)
  - `GITHUB_REPO_NAME`: Repository name
  - `GITHUB_CALLBACK_SECRET`: Shared secret for callback signature verification (Plan 03)
  - `NEXT_PUBLIC_APP_URL`: Application base URL for callback webhook
- Throws descriptive error if any variable is missing
- Fail-fast pattern: Errors occur at trigger time, not startup

**Exported Function: `triggerProvisioningWorkflow(job)`:**
- **Parameters:** Provisioning job record (type-safe with Drizzle schema inference)
- **Returns:** `Promise<void>`
- **Logic:**
  1. Validates GitHub configuration
  2. Constructs workflow_dispatch API URL: `https://api.github.com/repos/{owner}/{repo}/actions/workflows/provision-agent.yml/dispatches`
  3. Makes POST request with headers:
     - `Accept: application/vnd.github+json`
     - `Authorization: Bearer {GITHUB_PAT}`
     - `X-GitHub-Api-Version: 2022-11-28`
     - `Content-Type: application/json`
  4. Sends payload:
     ```json
     {
       "ref": "main",
       "inputs": {
         "job_id": "<uuid>",
         "agent_id": "<uuid>",
         "region": "us-east",
         "callback_url": "https://<app-url>/api/webhooks/github"
       }
     }
     ```
  5. Verifies 204 No Content response (GitHub success code)
  6. Logs successful trigger with job ID

**Important Technical Notes:**
- Uses native `fetch` (Node.js 18+, no dependencies)
- workflow_dispatch API returns 204 with NO run ID (async by design)
- Workflow will POST its run ID back via callback webhook (Plan 03)
- Uses GITHUB_PAT (personal access token), NOT GITHUB_TOKEN (insufficient permissions)
- Workflow must be in `.github/workflows/provision-agent.yml` (hardcoded filename)

### 2. Enhanced Stripe Webhook Handler (`src/app/api/webhooks/stripe/route.ts`)

**New Imports:**
- `provisioningJobs`, `agents` from `@/lib/db/schema`
- `enqueueProvisioningJob`, `getJobByStripeEventId` from `@/lib/provisioning/queue`
- `triggerProvisioningWorkflow` from `@/lib/provisioning/github-actions`

**Modified `checkout.session.completed` Case:**

**Section 1: Existing subscription logic (preserved):**
- Retrieves Stripe subscription
- Calls `upsertSubscription(sub)` (unchanged)

**Section 2: NEW provisioning job logic:**
1. **Extract metadata from session:**
   - `agentId`: UUID of agent to provision
   - `userId`: UUID of user who purchased
   - `region`: Deployment region (defaults to "us-east")
   - Only proceed if both `agentId` and `userId` are present

2. **Idempotency check:**
   - Call `getJobByStripeEventId(event.id)`
   - If job exists, log skip message and break (webhook already processed)
   - Prevents duplicate jobs on Stripe webhook retries (up to 3 days)

3. **Enqueue provisioning job (outer try/catch):**
   - Call `enqueueProvisioningJob({ agentId, userId, stripeEventId: event.id, region })`
   - Internally checks for concurrent jobs (throws if user has in-progress job)
   - Creates job record with status "queued"
   - Log success: `[Stripe Webhook] Provisioning job {id} queued for agent {agentId}`

4. **Trigger GitHub Actions workflow (inner try/catch):**
   - Call `triggerProvisioningWorkflow(job)`
   - **Non-blocking design:** Wrapped in nested try/catch
   - If trigger fails:
     - Log error: `[Stripe Webhook] Failed to trigger workflow for job {id}`
     - Job stays "queued" in database
     - User can retry from dashboard (Phase 10)
     - Webhook response is NOT failed (job is already saved)
   - If trigger succeeds:
     - Workflow is dispatched (runs asynchronously)
     - Workflow will POST back via callback webhook (Plan 03)

5. **Error handling:**
   - Outer catch: `enqueueProvisioningJob` failure (concurrent job, DB error)
     - Log error but don't fail webhook
     - Common case: User has in-progress job
   - Inner catch: `triggerProvisioningWorkflow` failure (GitHub API error, missing env vars)
     - Log error but don't fail webhook
     - Job stays queued for manual retry

**Preserved Behavior:**
- All other event handlers unchanged (`customer.subscription.updated`, `invoice.paid`, etc.)
- `upsertSubscription` function unchanged
- Webhook still returns `NextResponse.json({ received: true })` at end
- Returns 200 within 2 seconds (Vercel timeout + Stripe expectation)

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions Made

1. **Workflow filename hardcoded as `provision-agent.yml`:** Standard naming convention for consistency. Could parameterize in future if needed for multi-workflow scenarios.

2. **Workflow ref hardcoded as `main`:** Assumes primary branch deployment. Could make configurable (e.g., `GITHUB_BRANCH` env var) in future.

3. **Non-blocking trigger with graceful degradation:** GitHub Actions trigger failure doesn't fail webhook response. Design prioritizes:
   - Stripe webhook reliability (return 200 quickly)
   - Job persistence (already saved in DB)
   - Manual retry capability (dashboard can re-trigger)
   - Observability (errors logged for debugging)

4. **Metadata dependency acknowledged:** Requires Stripe Checkout session to include `agentId`, `userId`, and optionally `region` in metadata. Implementation notes:
   - Wizard step 4 (Phase 10) must pass metadata when creating checkout session
   - If metadata missing, webhook silently skips provisioning (no crash)
   - This is acceptable: Checkout sessions created outside the agent wizard flow won't trigger provisioning

5. **Region default matches existing schema:** Uses "us-east" default from `agentInstances.region` for consistency.

6. **Environment validation at trigger time:** `getGitHubConfig()` validates env vars when `triggerProvisioningWorkflow` is called, not at module load. Benefits:
   - Clear error messages in logs
   - Webhook can still process other events if GitHub Actions is misconfigured
   - Errors are contextualized (job ID in error message)

## Technical Notes

### Idempotency Strategy

**Problem:** Stripe retries webhooks for up to 3 days if they fail (5xx) or timeout.

**Solution:**
- `stripeEventId` unique constraint on `provisioningJobs` table (Plan 01)
- Check `getJobByStripeEventId(event.id)` before creating job
- If job exists, log and skip (return 200)
- Prevents duplicate jobs from webhook retries

**Edge case handled:** If job creation succeeds but workflow trigger fails, the next webhook retry will see existing job and skip. Workflow can be manually re-triggered from dashboard.

### Speed and Reliability

**Performance targets:**
- Stripe expects webhook response within 5 seconds (timeout)
- Vercel serverless timeout: 10s (hobby) / 60s (pro)
- Target: Return 200 within 2 seconds

**Actual timing (estimated):**
1. Stripe signature verification: ~10ms
2. Subscription upsert: ~50ms (single DB query)
3. Idempotency check: ~20ms (indexed query)
4. Job enqueue: ~50ms (DB insert)
5. Workflow trigger: ~500ms (GitHub API call)
6. **Total: ~630ms** (well under 2-second target)

**Reliability guarantees:**
- Job creation is atomic (DB transaction)
- Idempotency prevents duplicates
- Non-blocking trigger allows webhook to succeed even if GitHub API is down
- Errors are logged for debugging

### Callback Flow (Plan 03 Preview)

**Current state after Plan 02:**
```
User completes checkout
  → Stripe webhook fires
    → Job created with status "queued"
    → GitHub Actions workflow dispatched
      → [Plan 03] Workflow claims job (status → "provisioning")
      → [Plan 03] Workflow posts heartbeats every 60s
      → [Plan 03] Workflow provisions infrastructure
      → [Plan 03] Workflow posts final status via callback
```

**Inputs passed to workflow:**
- `job_id`: UUID for database lookup and status updates
- `agent_id`: UUID for agent configuration retrieval
- `region`: Deployment region (e.g., "us-east")
- `callback_url`: `https://{app-url}/api/webhooks/github` for status updates

## Verification Results

**TypeScript Compilation:**
- ✅ `npx tsc --noEmit` passes with 0 non-test errors

**GitHub Actions Module:**
- ✅ `triggerProvisioningWorkflow` exported
- ✅ Fetch URL contains `actions/workflows/provision-agent.yml/dispatches`
- ✅ Environment validation throws on missing vars
- ✅ Returns 204 check implemented

**Stripe Webhook Handler:**
- ✅ `enqueueProvisioningJob` called in checkout.session.completed
- ✅ `getJobByStripeEventId` idempotency check implemented
- ✅ `triggerProvisioningWorkflow` called after job enqueue
- ✅ Nested try/catch for non-blocking trigger
- ✅ Returns `NextResponse.json({ received: true })` preserved

## Next Steps

**Immediate (Plan 03):**
- Create GitHub Actions workflow (`.github/workflows/provision-agent.yml`)
- Implement job claiming and heartbeat posting
- Implement callback webhook handler (`/api/webhooks/github`)
- Handle workflow status updates (claim, heartbeat, complete, fail)

**Integration Prerequisites:**
1. Set environment variables:
   - `GITHUB_PAT`: Create fine-grained token with Actions (write), Contents (read), Metadata (read)
   - `GITHUB_REPO_OWNER`: e.g., "your-username"
   - `GITHUB_REPO_NAME`: e.g., "aura"
   - `GITHUB_CALLBACK_SECRET`: Generate with `openssl rand -hex 32`
   - `NEXT_PUBLIC_APP_URL`: e.g., "https://aura.example.com"
   - Add `GITHUB_CALLBACK_SECRET` to both GitHub Actions secrets AND Vercel env vars

2. Update Stripe Checkout session creation (future):
   - Pass `agentId`, `userId`, `region` in session metadata
   - Location: Wizard step 4 / checkout API route

## Self-Check: PASSED

**Created files exist:**
- ✅ FOUND: src/lib/provisioning/github-actions.ts

**Modified files exist:**
- ✅ FOUND: src/app/api/webhooks/stripe/route.ts

**Commits exist:**
- ✅ FOUND: 3be5cee (Task 1: GitHub Actions trigger module)
- ✅ FOUND: 1e99037 (Task 2: Enhanced Stripe webhook)

**GitHub Actions module validation:**
- ✅ Function exported: `triggerProvisioningWorkflow`
- ✅ Validates 5 environment variables
- ✅ POSTs to workflow_dispatch API
- ✅ Includes job_id, agent_id, region, callback_url in inputs
- ✅ Checks for 204 response
- ✅ Logs success message with job ID

**Stripe webhook validation:**
- ✅ Imports all required functions
- ✅ Preserves existing subscription logic
- ✅ Extracts metadata: agentId, userId, region
- ✅ Idempotency check before job creation
- ✅ Enqueues provisioning job
- ✅ Triggers workflow with non-blocking try/catch
- ✅ Returns 200 even on trigger failure
- ✅ Other event handlers unchanged
