# Phase 6: Async Pipeline Foundation - Research

**Researched:** 2026-02-13
**Domain:** Async orchestration patterns with PostgreSQL job queues, GitHub Actions workflows, Stripe webhooks
**Confidence:** HIGH

## Summary

Phase 6 establishes the async orchestration pattern for long-running infrastructure operations. The pipeline receives a Stripe `checkout.session.completed` webhook event, queues a provisioning job in PostgreSQL (source of truth), triggers a GitHub Actions workflow via `workflow_dispatch`, receives status callbacks from the workflow, and updates the database in real-time.

This phase focuses on the SKELETON: the plumbing that connects payment → queue → GitHub Actions → callbacks. The actual VM creation (Phase 7), Ansible configuration (Phase 8), and lifecycle controls (Phase 9) plug into this foundation later.

The research reveals a well-established pattern: PostgreSQL job queues using `FOR UPDATE SKIP LOCKED` for concurrent dequeuing, GitHub Actions workflows triggered via REST API with `workflow_dispatch`, and webhook callbacks with HMAC signature verification. The stack is mature, documented, and battle-tested at scale.

**Primary recommendation:** Use PostgreSQL-native job queue (no external library) with `FOR UPDATE SKIP LOCKED` for dequeuing, GitHub Actions `workflow_dispatch` for triggering (supports inputs and secrets), and custom callback endpoint with HMAC verification for status updates. This avoids external dependencies while providing exactly-once semantics and audit trails.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Provisioning trigger flow:**
- Full flow: Wizard step 4 submit → create agent as "draft" + redirect to Stripe Checkout → payment succeeds → `checkout.session.completed` webhook fires → creates subscription + queues provisioning job → GitHub Actions runs → VM provisioned
- The trigger is the Stripe webhook, not a manual deploy button
- Wizard Review step (step 4) both creates the agent record AND redirects to Stripe Checkout in one action
- Per-agent checkout: paying for this agent creates the subscription and triggers provisioning in a single flow

**Status progression:**
- 3 simple states: Queued → Provisioning → Running
- Machine states only — no human-readable messages. Human-friendly text is a UI concern for Phase 10
- Provisioning states only for now — destruction/stopped states added in Phase 9
- Job records kept forever for audit/debugging

**Failure & retry behavior:**
- Manual retry only — system marks job as failed, user clicks "retry" in dashboard (Phase 10)
- Auto-cleanup on failure — delete orphaned VMs/resources automatically, clean slate for retry
- Store error details — save error message, which step failed, and workflow run ID
- Capped retries: 3-5 attempts per agent before requiring support intervention (prevents cost spirals from repeated failures)

**Concurrent provisioning:**
- One provision at a time per user — block additional provisions with a message if one is already in progress
- Parallel across users — multiple users can provision simultaneously (independent GitHub Actions runs)
- No system-wide concurrency cap for now — at 50-200 agents, unlikely to hit issues

**Job lifecycle & timeouts:**
- Timeout: minimum 10 minutes (Claude to determine exact value based on pipeline stages, erring conservative)
- Heartbeat mechanism: GitHub Actions workflow periodically signals it's still alive. System distinguishes alive-but-slow from truly stuck.
- Stale job cleanup strategy: Claude's discretion on background sweep vs on-demand detection

### Claude's Discretion
- Exact timeout value (minimum 10 minutes)
- Terminal failure state design (explicit "failed" state vs staying at last state)
- Stale job cleanup mechanism (background sweep vs on-demand)
- Heartbeat interval and missed-heartbeat threshold
- Database schema details for job queue table
- GitHub Actions trigger mechanism (repository dispatch vs workflow dispatch)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 18+ | Job queue storage + state management | Native SKIP LOCKED (9.5+), LISTEN/NOTIFY, ACID guarantees. Database is source of truth. |
| Drizzle ORM | 0.45.1 (current) | Database access + migrations | Already in project. Type-safe queries, migration management. |
| Stripe Node SDK | 20.3.1 (current) | Webhook verification + subscription management | Official SDK with signature verification built-in. |
| GitHub Actions | N/A (platform) | Workflow execution runtime | Built into GitHub. No Vercel timeout limits (10-60s). |
| GitHub REST API | v3 | Trigger workflows via workflow_dispatch | Official API for external triggers. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (Node.js) | Built-in | HMAC signature verification for callbacks | Custom webhook endpoint security. |
| pg-boss | Optional | If complexity grows | Only if manual queue becomes unmanageable (unlikely at 50-200 agents). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL queue | Redis/BullMQ | PostgreSQL keeps audit trail + ACID guarantees. Redis faster but adds dependency. Database is already source of truth. |
| workflow_dispatch | repository_dispatch | workflow_dispatch supports non-default branches + typed inputs. More flexible. |
| Custom queue | pg-boss | pg-boss adds retry logic, dead letter queue, priorities. Overkill for 50-200 agents. Manual queue keeps it simple. |

**Installation:**
```bash
# No new dependencies needed for Phase 6
# Using: drizzle-orm, stripe (already installed)
# Using: GitHub REST API (fetch/curl), crypto (built-in)
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/api/
│   ├── webhooks/
│   │   ├── stripe/route.ts          # Enhanced with job queue creation
│   │   └── github/route.ts          # NEW: Callback endpoint for GitHub Actions
│   └── agents/[id]/
│       └── provision/route.ts       # Existing (to be updated for new flow)
├── lib/
│   ├── provisioning/
│   │   ├── queue.ts                 # NEW: Job queue operations (enqueue, dequeue, update)
│   │   ├── github-actions.ts        # NEW: Trigger workflow_dispatch
│   │   └── index.ts                 # Existing (update exports)
│   └── db/
│       └── schema.ts                # NEW: Add provisioning_jobs table
.github/
└── workflows/
    └── provision-agent.yml          # NEW: Workflow that provisions VM
```

### Pattern 1: Idempotent Webhook Handler
**What:** Stripe webhook receives `checkout.session.completed` and creates job ONCE (idempotency by event ID)
**When to use:** All webhook handlers to prevent duplicate processing on retries
**Example:**
```typescript
// Source: https://docs.stripe.com/webhooks/signature
// Stripe retries webhooks for up to 3 days. Track event IDs to prevent duplicates.

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  // Verify signature
  const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);

  // Idempotency: check if event already processed
  const existingJob = await db.query.provisioningJobs.findFirst({
    where: eq(provisioningJobs.stripeEventId, event.id)
  });

  if (existingJob) {
    console.log(`Event ${event.id} already processed`);
    return NextResponse.json({ received: true }); // Return 200
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const agentId = session.metadata.agentId; // Passed during checkout

    // Create subscription + queue provisioning job in transaction
    await db.transaction(async (tx) => {
      // Create subscription record
      await tx.insert(subscriptions).values({...});

      // Create provisioning job
      await tx.insert(provisioningJobs).values({
        agentId,
        stripeEventId: event.id, // For idempotency
        status: "queued",
        retryCount: 0,
      });
    });
  }

  return NextResponse.json({ received: true }); // Return 200 within 2 seconds
}
```

### Pattern 2: PostgreSQL Job Queue Dequeue
**What:** Use `FOR UPDATE SKIP LOCKED` to atomically claim jobs for processing
**When to use:** Concurrent workers dequeuing from shared job table
**Example:**
```typescript
// Source: https://www.inferable.ai/blog/posts/postgres-skip-locked
// SKIP LOCKED (PostgreSQL 9.5+) allows multiple workers without blocking

async function dequeueNextJob(userId: string): Promise<ProvisioningJob | null> {
  return await db.transaction(async (tx) => {
    // Atomic claim: SELECT + UPDATE in one transaction
    const [job] = await tx
      .select()
      .from(provisioningJobs)
      .where(
        and(
          eq(provisioningJobs.userId, userId), // User-scoped
          eq(provisioningJobs.status, "queued"),
          or(
            isNull(provisioningJobs.claimedAt),
            sql`${provisioningJobs.claimedAt} < NOW() - INTERVAL '10 minutes'` // Stale claim
          )
        )
      )
      .orderBy(asc(provisioningJobs.createdAt)) // FIFO
      .limit(1)
      .forUpdate() // Lock row
      .skipLocked(); // Skip if another worker already locked it

    if (!job) return null;

    // Update status atomically
    await tx
      .update(provisioningJobs)
      .set({
        status: "provisioning",
        claimedAt: new Date(),
      })
      .where(eq(provisioningJobs.id, job.id));

    return job;
  });
}
```

### Pattern 3: Trigger GitHub Actions Workflow
**What:** Use GitHub REST API `workflow_dispatch` to trigger workflow with inputs
**When to use:** External system needs to trigger GitHub Actions workflow
**Example:**
```typescript
// Source: https://docs.github.com/en/rest/actions/workflows
// workflow_dispatch supports typed inputs + secrets

async function triggerProvisioningWorkflow(job: ProvisioningJob) {
  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`,
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`, // Fine-grained PAT with Actions: write
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main", // Branch to run workflow on
        inputs: {
          job_id: job.id,
          agent_id: job.agentId,
          region: job.region,
          callback_url: `${process.env.APP_URL}/api/webhooks/github`,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to trigger workflow: ${response.statusText}`);
  }

  // Note: API returns 204 No Content. Run ID not available until workflow starts.
  // Workflow will post run ID back via callback.
}
```

### Pattern 4: GitHub Actions Callback with HMAC Verification
**What:** Workflow posts status updates to API endpoint. Verify HMAC signature.
**When to use:** External system (GitHub Actions) posts data to your API
**Example:**
```typescript
// Source: https://prismatic.io/blog/how-secure-webhook-endpoints-hmac
// HMAC-SHA256 signature verification prevents unauthorized callbacks

export async function POST(request: Request) {
  const body = await request.text(); // Raw body for signature verification
  const signature = request.headers.get("x-signature");

  // Verify HMAC signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.GITHUB_CALLBACK_SECRET!)
    .update(body)
    .digest("hex");

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);

  // Update job status
  await db
    .update(provisioningJobs)
    .set({
      status: payload.status, // "provisioning" | "running" | "failed"
      workflowRunId: payload.workflow_run_id,
      error: payload.error,
      lastHeartbeatAt: new Date(),
    })
    .where(eq(provisioningJobs.id, payload.job_id));

  return NextResponse.json({ received: true });
}
```

### Pattern 5: Heartbeat and Timeout Detection
**What:** Workflow periodically posts heartbeat. System detects stale jobs.
**When to use:** Long-running operations need liveness detection
**Example:**
```typescript
// Source: https://github.com/rails/solid_queue
// Heartbeat pattern with configurable timeout

const HEARTBEAT_INTERVAL = 60; // seconds (Claude's discretion)
const HEARTBEAT_TIMEOUT = 600; // 10 minutes (minimum per user constraint)

// In GitHub Actions workflow:
// - Step 1: POST callback with status="provisioning" + workflow_run_id
// - Step 2: Loop { sleep 60s, POST heartbeat }
// - Step 3: Provision VM
// - Step 4: POST callback with status="running" OR status="failed"

// On-demand stale job detection (no background sweep needed at this scale):
async function checkJobTimeout(jobId: string): Promise<boolean> {
  const job = await db.query.provisioningJobs.findFirst({
    where: eq(provisioningJobs.id, jobId)
  });

  if (!job || job.status !== "provisioning") return false;

  const now = new Date();
  const lastHeartbeat = job.lastHeartbeatAt || job.updatedAt;
  const secondsSinceHeartbeat = (now.getTime() - lastHeartbeat.getTime()) / 1000;

  if (secondsSinceHeartbeat > HEARTBEAT_TIMEOUT) {
    // Mark as failed (timeout)
    await db
      .update(provisioningJobs)
      .set({
        status: "failed",
        error: `Timeout: No heartbeat for ${Math.floor(secondsSinceHeartbeat)}s`,
      })
      .where(eq(provisioningJobs.id, jobId));

    return true;
  }

  return false;
}
```

### Pattern 6: GitHub Actions Workflow File
**What:** Workflow YAML with `workflow_dispatch` trigger and inputs
**When to use:** Defining GitHub Actions workflows
**Example:**
```yaml
# Source: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
# .github/workflows/provision-agent.yml

name: Provision Agent

on:
  workflow_dispatch:
    inputs:
      job_id:
        description: 'Provisioning job ID'
        required: true
        type: string
      agent_id:
        description: 'Agent ID to provision'
        required: true
        type: string
      region:
        description: 'Hetzner region'
        required: true
        type: string
      callback_url:
        description: 'Callback URL for status updates'
        required: true
        type: string

jobs:
  provision:
    runs-on: ubuntu-latest
    timeout-minutes: 15 # Conservative timeout (Claude's discretion)

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Send initial callback
        run: |
          SIGNATURE=$(echo -n '{"job_id":"${{ inputs.job_id }}","status":"provisioning","workflow_run_id":"${{ github.run_id }}"}' | \
            openssl dgst -sha256 -hmac "${{ secrets.GITHUB_CALLBACK_SECRET }}" -hex | awk '{print $2}')

          curl -X POST "${{ inputs.callback_url }}" \
            -H "Content-Type: application/json" \
            -H "X-Signature: $SIGNATURE" \
            -d '{"job_id":"${{ inputs.job_id }}","status":"provisioning","workflow_run_id":"${{ github.run_id }}"}'

      - name: Provision VM (placeholder)
        run: |
          echo "Would provision VM for agent ${{ inputs.agent_id }} in ${{ inputs.region }}"
          echo "Phase 7 will implement actual Hetzner API calls"
          sleep 5 # Simulate work

      - name: Send success callback
        if: success()
        run: |
          SIGNATURE=$(echo -n '{"job_id":"${{ inputs.job_id }}","status":"running"}' | \
            openssl dgst -sha256 -hmac "${{ secrets.GITHUB_CALLBACK_SECRET }}" -hex | awk '{print $2}')

          curl -X POST "${{ inputs.callback_url }}" \
            -H "Content-Type: application/json" \
            -H "X-Signature: $SIGNATURE" \
            -d '{"job_id":"${{ inputs.job_id }}","status":"running"}'

      - name: Send failure callback
        if: failure()
        run: |
          SIGNATURE=$(echo -n '{"job_id":"${{ inputs.job_id }}","status":"failed","error":"Workflow failed at step ${{ job.status }}"}' | \
            openssl dgst -sha256 -hmac "${{ secrets.GITHUB_CALLBACK_SECRET }}" -hex | awk '{print $2}')

          curl -X POST "${{ inputs.callback_url }}" \
            -H "Content-Type: application/json" \
            -H "X-Signature: $SIGNATURE" \
            -d '{"job_id":"${{ inputs.job_id }}","status":"failed","error":"Workflow failed"}'
```

### Anti-Patterns to Avoid
- **Polling for workflow status:** GitHub Actions API doesn't return run ID on dispatch. Use callbacks instead.
- **Long-running webhook handlers:** Stripe expects 200 within 20 seconds. Queue job, return immediately.
- **Forgetting idempotency:** Webhooks retry. Always check if event/job already processed.
- **Using GITHUB_TOKEN for workflow_dispatch:** GITHUB_TOKEN doesn't have permission to trigger workflows. Use PAT with Actions: write permission.
- **Ignoring transaction boundaries:** LISTEN/NOTIFY fires only on COMMIT. Queue job + send notification in same transaction.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue with retry logic | Custom retry scheduler | PostgreSQL + manual queue OR pg-boss if complex | FOR UPDATE SKIP LOCKED handles concurrency. Manual retry on user click is sufficient. Audit trail built-in. |
| Webhook signature verification | Custom crypto implementation | Stripe SDK `constructEvent()` | Handles timing attacks, version compatibility, error messages. Battle-tested. |
| HMAC signature generation | Custom HMAC logic | Node.js `crypto.createHmac()` | Constant-time comparison, proper encoding, no timing attacks. |
| Distributed locks | Application-level locks | PostgreSQL row-level locks + SKIP LOCKED | Database guarantees atomicity. No Redis needed. |
| Workflow run ID tracking | Custom correlation system | Pass job_id in inputs, workflow posts back run_id | GitHub Actions doesn't return run ID on dispatch. Callback pattern is standard. |

**Key insight:** PostgreSQL's concurrency primitives (row-level locks, SKIP LOCKED, transactions) eliminate the need for external job queue libraries at this scale (50-200 agents). The database is already the source of truth. Keep it simple.

## Common Pitfalls

### Pitfall 1: Stripe Webhook Idempotency
**What goes wrong:** Duplicate provisioning jobs created when Stripe retries webhook (network blip, slow response).
**Why it happens:** Not tracking event IDs. Stripe retries for up to 3 days.
**How to avoid:** Store `stripeEventId` in `provisioningJobs` table with unique constraint. Check before inserting.
**Warning signs:** Multiple jobs for same agent. Logs show same event ID processed twice.

### Pitfall 2: Next.js 15 App Router Body Parsing
**What goes wrong:** Stripe signature verification fails with "No signatures found matching the expected signature for payload" error.
**Why it happens:** Using `await request.json()` instead of `await request.text()`. Stripe needs raw body for signature.
**How to avoid:** Always use `request.text()` for webhook handlers. App Router has no body parser config (it's disabled by default).
**Warning signs:** Signature verification fails locally and in production. Error mentions "payload mismatch."

### Pitfall 3: GitHub Actions workflow_dispatch Run ID
**What goes wrong:** Trying to immediately fetch workflow status after triggering dispatch. Run doesn't exist yet.
**Why it happens:** `workflow_dispatch` API returns 204 No Content (no run ID). Workflow starts asynchronously.
**How to avoid:** Use callback pattern. Workflow posts its `github.run_id` in first step. Store in `workflowRunId` column.
**Warning signs:** 404 errors when querying workflow run. Polling code that never finds the run.

### Pitfall 4: Concurrent Provisioning Per User
**What goes wrong:** User triggers provisioning for Agent A, then Agent B. Both jobs run simultaneously, causing race conditions or quota issues.
**Why it happens:** No concurrency control at user level. Queue processes all jobs.
**How to avoid:** Check for existing provisioning job for user before queueing new one. Return error: "You have a provisioning job in progress for Agent X."
**Warning signs:** Multiple GitHub Actions workflows running for same user. Hetzner quota errors.

### Pitfall 5: Transaction Boundaries and LISTEN/NOTIFY
**What goes wrong:** NOTIFY sent inside transaction fires before COMMIT. Listener processes job before it's visible in database.
**Why it happens:** PostgreSQL NOTIFY is transactional. Only fires on successful COMMIT.
**How to avoid:** Don't use LISTEN/NOTIFY for job triggering. Trigger GitHub Actions directly after job insert. OR use NOTIFY but ensure listener polls if job not found.
**Warning signs:** Race conditions where workflow can't find job record. Intermittent "job not found" errors.

### Pitfall 6: HMAC Timing Attacks
**What goes wrong:** Attackers forge signatures by measuring response times during comparison.
**Why it happens:** Using `===` for string comparison (early exit on mismatch).
**How to avoid:** Use `crypto.timingSafeEqual()` for signature comparison. Compare buffers, not strings.
**Warning signs:** Security audit flags timing-based vulnerabilities. Logs show repeated failed signature attempts with incremental changes.

### Pitfall 7: Missing Indexes on Job Queue Table
**What goes wrong:** Dequeue query scans entire table. Slow at 1000+ jobs.
**Why it happens:** No index on `(status, createdAt)` for job selection query.
**How to avoid:** Create composite index `CREATE INDEX idx_jobs_dequeue ON provisioning_jobs(user_id, status, created_at)`. Supports WHERE + ORDER BY.
**Warning signs:** Slow query logs. Dequeue takes >100ms. Database CPU spikes during provisioning.

### Pitfall 8: GitHub PAT Permissions
**What goes wrong:** 403 error when triggering workflow_dispatch: "Resource not accessible by personal access token."
**Why it happens:** Fine-grained PAT needs `Actions: write` AND `Contents: read` permissions.
**How to avoid:** Create fine-grained PAT with Actions (read/write) + Contents (read) + Metadata (read). Limit to specific repo.
**Warning signs:** 403 on workflow dispatch API call. GitHub logs show "insufficient permissions."

### Pitfall 9: Vercel Timeout on Webhook Handler
**What goes wrong:** Webhook handler times out (10s Hobby, 15s Pro default) because it triggers workflow AND waits for response.
**Why it happens:** Doing too much in webhook handler. Stripe expects 200 within 20 seconds (but Vercel timeout is lower).
**How to avoid:** Queue job in database (fast), return 200 immediately. Trigger GitHub Actions in separate API call or on-demand poll.
**Warning signs:** 504 errors in Stripe webhook logs. Vercel function timeouts. Stripe marks endpoint as failing.

## Code Examples

Verified patterns from official sources:

### Creating GitHub Fine-Grained PAT for workflow_dispatch
```bash
# Source: https://www.eliostruyf.com/dispatch-github-action-fine-grained-personal-access-token
# GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens

# Required permissions:
# - Repository access: Select specific repositories (your repo)
# - Permissions:
#   - Actions: Read and write
#   - Contents: Read-only
#   - Metadata: Read-only (automatically selected)

# Store in environment variable:
# GITHUB_TOKEN=github_pat_xxxxxxxxxxxxx
```

### Stripe Checkout Metadata for Agent ID
```typescript
// Source: https://docs.stripe.com/metadata
// Pass agentId in metadata, retrieved in webhook

const session = await stripe.checkout.sessions.create({
  customer: user.stripeCustomerId,
  line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
  mode: "subscription",
  success_url: `${process.env.APP_URL}/dashboard/agents/${agentId}`,
  cancel_url: `${process.env.APP_URL}/agents/${agentId}/wizard?step=4`,
  metadata: {
    agentId, // Retrieved in checkout.session.completed webhook
    userId: user.id,
  },
});

// In webhook:
const agentId = session.metadata.agentId;
```

### Database Schema for Provisioning Jobs
```typescript
// src/lib/db/schema.ts
export const provisioningJobs = pgTable("provisioning_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  stripeEventId: text("stripe_event_id").unique(), // For idempotency
  status: pgEnum("job_status", ["queued", "provisioning", "running", "failed"]).notNull().default("queued"),
  region: text("region").notNull(),

  // Workflow tracking
  workflowRunId: text("workflow_run_id"), // GitHub Actions run ID

  // Retry tracking
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3), // User constraint: 3-5

  // Error tracking
  error: text("error"),
  failedStep: text("failed_step"), // Which step failed (for debugging)

  // Lifecycle tracking
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Indexes for performance
// CREATE INDEX idx_jobs_dequeue ON provisioning_jobs(user_id, status, created_at);
// CREATE INDEX idx_jobs_stripe_event ON provisioning_jobs(stripe_event_id); (automatic via unique)
```

### Checking for Concurrent Provisioning
```typescript
// Before queueing new job, check if user already has one in progress
async function checkConcurrentProvision(userId: string): Promise<boolean> {
  const inProgressJob = await db.query.provisioningJobs.findFirst({
    where: and(
      eq(provisioningJobs.userId, userId),
      or(
        eq(provisioningJobs.status, "queued"),
        eq(provisioningJobs.status, "provisioning")
      )
    ),
    with: {
      agent: true, // Include agent name for error message
    },
  });

  if (inProgressJob) {
    throw new Error(
      `You already have a provisioning job in progress for agent "${inProgressJob.agent.name}". ` +
      `Please wait for it to complete before provisioning another agent.`
    );
  }

  return false;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| repository_dispatch | workflow_dispatch | 2021 | workflow_dispatch supports non-default branches, typed inputs, better DX |
| Polling GitHub API for run status | Callback webhooks | Ongoing | API doesn't return run ID on dispatch. Callbacks avoid race conditions. |
| Body parser config in API routes | request.text() in App Router | Next.js 13 (2023) | No config needed. Simpler webhook handling. |
| Classic Personal Access Tokens | Fine-grained PATs | 2023 | Scoped permissions, repo-specific, better security. |
| External job queue (Redis/RabbitMQ) | PostgreSQL-native queues | Ongoing | SKIP LOCKED (2016) made PostgreSQL viable. Simpler stack, audit trail. |
| pg-boss for all queues | Manual queue for simple cases | Ongoing | pg-boss overkill for 50-200 agents. Manual queue sufficient. |

**Deprecated/outdated:**
- **API Routes body parser config:** Next.js 15 App Router doesn't support `export const config = { api: { bodyParser: false } }`. Use `request.text()` instead.
- **GITHUB_TOKEN for workflow_dispatch:** Doesn't have permission. Must use fine-grained PAT with Actions: write.
- **repository_dispatch for same-repo triggers:** workflow_dispatch more ergonomic, supports inputs/types.

## Open Questions

1. **Exact timeout value (minimum 10 minutes)**
   - What we know: VM creation ~2-3 min, Ansible ~3-5 min, buffer needed
   - What's unclear: Should we set 10min (tight) or 15min (safe)?
   - Recommendation: **15 minutes** (900s). Conservative. Phases 7-8 will reveal actual timing. Easy to reduce later.

2. **Heartbeat interval and missed-heartbeat threshold**
   - What we know: Workflow needs to signal it's alive. Timeout at 10+ minutes.
   - What's unclear: Heartbeat every 30s? 60s? 120s? Threshold 2x? 3x?
   - Recommendation: **Heartbeat every 60s, timeout at 10 minutes (600s = 10 missed heartbeats)**. Balances liveness detection with API call volume.

3. **Stale job cleanup: background sweep vs on-demand**
   - What we know: Jobs can stall (network, GitHub outage). Need detection.
   - What's unclear: Poll every 5min for stale jobs? Or check on-demand (user refreshes dashboard)?
   - Recommendation: **On-demand only**. At 50-200 agents, background sweep overkill. Dashboard API checks timeout on GET /api/agents/[id]/provision. Simpler.

4. **Terminal failure state: explicit "failed" or stay at last state?**
   - What we know: User constraint says store error details. Need to show failed state.
   - What's unclear: Mark status="failed" or keep status="provisioning" + error field?
   - Recommendation: **Explicit "failed" state**. Cleaner. UI can filter by status. Error field provides details. status="failed" is unambiguous.

5. **GitHub Actions trigger: after webhook or separate cron?**
   - What we know: Vercel timeout risk (10-60s). Stripe expects 200 within 20s.
   - What's unclear: Trigger workflow immediately after job insert? Or poll queue every minute?
   - Recommendation: **Trigger immediately after job insert**. Simpler. Fetch call to GitHub API is <500ms. Still well under Vercel timeout. No polling needed.

## Sources

### Primary (HIGH confidence)
- [PostgreSQL FOR UPDATE SKIP LOCKED Documentation](https://www.postgresql.org/docs/current/explicit-locking.html) - Row-level locking
- [Stripe Webhooks Signature Verification](https://docs.stripe.com/webhooks/signature) - Idempotency best practices
- [GitHub Actions workflow_dispatch API](https://docs.github.com/en/rest/actions/workflows) - Triggering workflows externally
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions) - YAML inputs, secrets
- [Next.js 15 Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route) - App Router webhook handling
- [Stripe Metadata Documentation](https://docs.stripe.com/metadata) - Passing custom data
- [Vercel Function Limits](https://vercel.com/docs/functions/limitations) - Timeout constraints

### Secondary (MEDIUM confidence)
- [pg-boss PostgreSQL Job Queue](https://github.com/timgit/pg-boss) - Reference implementation
- [The Unreasonable Effectiveness of SKIP LOCKED](https://www.inferable.ai/blog/posts/postgres-skip-locked) - Job queue pattern
- [How to Secure Webhook Endpoints with HMAC](https://prismatic.io/blog/how-secure-webhook-endpoints-hmac) - HMAC verification
- [Stripe Webhooks Guide](https://www.magicbell.com/blog/stripe-webhooks-guide) - Best practices
- [GitHub Actions Heartbeat Pattern](https://github.com/rails/solid_queue) - Liveness detection
- [Dispatch GitHub Action via Fine-Grained PAT](https://www.eliostruyf.com/dispatch-github-action-fine-grained-personal-access-token) - Permissions guide

### Tertiary (LOW confidence)
- Community discussions on GitHub workflow_dispatch run ID tracking
- Medium articles on PostgreSQL job queue design patterns
- Stack Overflow discussions on Next.js webhook body parsing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - PostgreSQL, Stripe SDK, GitHub Actions are mature, documented, battle-tested
- Architecture: HIGH - Patterns verified with official docs, established best practices
- Pitfalls: MEDIUM-HIGH - Mix of documented issues and inferred from community reports
- Open questions: MEDIUM - Recommendations based on constraints + extrapolation, Phase 7-8 will validate

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (30 days - stable technologies, slow-moving APIs)
