# Phase 10: Status Integration - Research

**Researched:** 2026-02-13
**Domain:** Real-time status updates, dashboard synchronization, async pipeline observability
**Confidence:** HIGH

## Summary

Phase 10 connects the existing GitHub Actions provisioning workflow (Phases 6-8) to the existing dashboard UI, replacing simulated status with real infrastructure data. The system already has the foundation: workflows POST callbacks with status updates, the database stores agent instances with status fields, and the UI polls for updates. This phase bridges the gap by mapping granular workflow steps to the dashboard's provisioning progress visualization.

The current architecture uses client-side polling (1-second interval) in the ProvisioningStatus component to fetch updates from `/api/agents/[id]/instance`. The backend returns status from `agentInstances.status` (enum: pending, provisioning, running, stopping, stopped, failed). The workflow sends THREE callback points: (1) status=provisioning when workflow starts, (2) heartbeats every 60s, (3) status=running with VM metadata on success OR status=failed with error details on failure.

The gap: the UI displays 5 granular steps (Queued → Creating Server → Installing Dependencies → Configuring Agent → Running) but the workflow only sends 2 status updates (provisioning, running/failed). The `getProvisioningSteps()` function hard-codes step states based on overall status, showing "mid-way through" for status=provisioning, which provides no real visibility into actual progress.

This phase implements GRANULAR callbacks from the workflow and a STATUS MAPPING system that translates workflow steps into dashboard UI states. The pattern: workflows POST additional callbacks as they complete major steps, the callback handler updates the database with sub-step information (stored in a new `currentStep` field or `metadata` JSONB), and the API endpoint enriches the response with real-time step progress.

**Primary recommendation:** Add granular callbacks to the workflow (after each major step: VM created, Tailscale connected, Ansible started, Ansible complete), extend the callback handler to store step progress in `agentInstances` table, modify `getProvisioningSteps()` to derive UI step states from real database state instead of hard-coded mappings. Keep polling as the delivery mechanism (SSE adds complexity without clear benefit for 5-second latency requirement).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 16.1.6 | Current | API routes for status endpoint | Already in use, App Router with route handlers |
| PostgreSQL | Current | Status storage (agentInstances table) | Already source of truth, ACID guarantees |
| Drizzle ORM | 0.45.1 | Type-safe queries for status updates | Already in use for all DB operations |
| React Hooks | 19.2.3 | Client-side polling (useEffect, useCallback) | Built-in, already used in ProvisioningStatus component |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SWR | Optional | Alternative to manual polling | If refactoring polling logic, provides stale-while-revalidate pattern |
| React Query | Optional | Alternative polling with caching | If need advanced features like automatic retries, cache invalidation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client polling | Server-Sent Events (SSE) | SSE provides push updates (lower latency) but adds server complexity, connection management, browser compatibility concerns. Polling meets 5-second requirement simply. |
| Client polling | WebSockets | WebSockets support bidirectional communication but overkill for one-way status updates. Adds connection state management, scaling concerns. |
| Client polling | PostgreSQL LISTEN/NOTIFY + SSE | Elegant database-driven push but requires persistent connections, complex error handling. Over-engineered for this use case. |
| Status in metadata JSONB | Separate step_status table | Separate table enables richer query patterns but adds JOIN complexity. JSONB sufficient for simple progress tracking. |

**Installation:**
```bash
# No new dependencies needed
# Using existing: next, drizzle-orm, react, postgres
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/api/
│   ├── agents/[id]/
│   │   └── instance/route.ts        # [UPDATE] Enrich response with step progress
│   └── webhooks/
│       └── github/route.ts          # [UPDATE] Handle granular step callbacks
├── lib/
│   ├── provisioning/
│   │   ├── index.ts                 # [UPDATE] getProvisioningSteps() uses real data
│   │   ├── queue.ts                 # [UPDATE] Store step progress in metadata
│   │   └── steps.ts                 # [NEW] Step mapping logic (workflow → UI)
│   └── db/
│       └── schema.ts                # [UPDATE] Add currentStep or extend metadata
├── components/
│   └── dashboard/
│       └── provisioning-status.tsx  # [MINIMAL UPDATE] Already polls, just receives better data
.github/workflows/
└── provision-agent.yml              # [UPDATE] Add granular callbacks after each step
```

### Pattern 1: Granular Workflow Callbacks
**What:** Workflow POSTs status updates after each major step completion
**When to use:** Long-running workflows where users need visibility into progress
**Example:**
```bash
# Source: Existing .github/workflows/provision-agent.yml pattern
# Add callbacks after each major step (VM provision, Ansible run, etc.)

# After VM provisioning completes
- name: Send VM created callback
  if: steps.provision.outcome == 'success'
  run: |
    BODY='{"job_id":"${{ inputs.job_id }}","status":"provisioning","step":"vm_created","metadata":{"server_id":"${{ steps.provision.outputs.server_id }}"}}'
    SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "${{ secrets.GITHUB_CALLBACK_SECRET }}" -hex | awk '{print $NF}')

    curl -sf -X POST "${{ inputs.callback_url }}" \
      -H "Content-Type: application/json" \
      -H "X-Signature: $SIGNATURE" \
      -d "$BODY"

# After Tailscale setup completes
- name: Send network configured callback
  if: steps.provision.outcome == 'success'
  run: |
    BODY='{"job_id":"${{ inputs.job_id }}","status":"provisioning","step":"network_configured"}'
    # ... same HMAC signing and POST pattern
```

**Step identifiers to add:**
- `vm_created` - After Hetzner server provisioned (step: Provision VM)
- `network_configured` - After Tailscale connected (step: Provision VM outputs tailscale_ip)
- `ansible_started` - Before Ansible playbook runs (step: Configure VM with Ansible)
- `ansible_complete` - After Ansible playbook succeeds (step: Configure VM with Ansible)

### Pattern 2: Step Progress Storage in Database
**What:** Store current step in agentInstances table for status API to return
**When to use:** Async operations where frontend needs sub-step visibility
**Example:**
```typescript
// Source: Derived from src/lib/provisioning/queue.ts pattern
// Extend agentInstances table and update functions

// Add to schema.ts
export const agentInstances = pgTable("agent_instances", {
  // ... existing fields
  currentStep: text("current_step"), // NEW: vm_created, network_configured, ansible_started, etc.
  stepMetadata: jsonb("step_metadata").$type<Record<string, unknown>>(), // NEW: step-specific data
});

// In queue.ts - new function to update step progress
export async function updateProvisioningStep(params: {
  jobId: string;
  step: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { jobId, step, metadata } = params;

  // Get job to find agentId
  const [job] = await db
    .select()
    .from(provisioningJobs)
    .where(eq(provisioningJobs.id, jobId))
    .limit(1);

  if (!job) throw new Error(`Job not found: ${jobId}`);

  // Update instance with current step
  const [instance] = await db
    .select()
    .from(agentInstances)
    .where(eq(agentInstances.agentId, job.agentId))
    .orderBy(desc(agentInstances.createdAt))
    .limit(1);

  if (instance) {
    await db
      .update(agentInstances)
      .set({
        currentStep: step,
        stepMetadata: metadata || {},
        updatedAt: new Date(),
      })
      .where(eq(agentInstances.id, instance.id));
  }

  console.log(`[Queue] Updated instance ${instance?.id} to step: ${step}`);
}
```

### Pattern 3: Dynamic Step State Derivation
**What:** Derive UI step states from database step field instead of hard-coded mapping
**When to use:** Status UI that needs to reflect actual backend progress
**Example:**
```typescript
// Source: Refactor of src/lib/provisioning/index.ts getProvisioningSteps()
// Replace hard-coded status → step mapping with real step data

export function getProvisioningSteps(
  status: ProvisioningStatus["status"],
  currentStep?: string | null
): ProvisioningStep[] {
  const steps: ProvisioningStep[] = [
    { id: "queued", label: "Queued", status: "pending" },
    { id: "creating", label: "Creating Server", status: "pending" },
    { id: "networking", label: "Configuring Network", status: "pending" },
    { id: "installing", label: "Installing Dependencies", status: "pending" },
    { id: "running", label: "Running", status: "pending" },
  ];

  // Map workflow steps to UI step IDs
  const stepMapping: Record<string, number> = {
    "vm_created": 1,          // Creating Server complete
    "network_configured": 2,  // Configuring Network complete
    "ansible_started": 3,     // Installing Dependencies active
    "ansible_complete": 4,    // Installing Dependencies complete, Running pending
  };

  // Terminal states
  if (status === "running") {
    return steps.map((step, i) => ({ ...step, status: i < 5 ? "completed" : "pending" }));
  }
  if (status === "failed") {
    // Mark steps up to failure point as completed, failure point as error
    const failedIndex = currentStep ? stepMapping[currentStep] || 2 : 2;
    return steps.map((step, i) => ({
      ...step,
      status: i < failedIndex ? "completed" : i === failedIndex ? "error" : "pending",
    }));
  }

  // In-progress: use currentStep to determine active/completed states
  if (status === "provisioning" && currentStep) {
    const activeIndex = stepMapping[currentStep];
    if (activeIndex !== undefined) {
      return steps.map((step, i) => ({
        ...step,
        status: i < activeIndex ? "completed" : i === activeIndex ? "active" : "pending",
      }));
    }
  }

  // Fallback: status=pending or unknown step
  if (status === "pending") {
    return steps.map((step, i) => ({ ...step, status: i === 0 ? "active" : "pending" }));
  }

  // Default: first step active
  return steps.map((step, i) => ({ ...step, status: i === 0 ? "active" : "pending" }));
}
```

### Pattern 4: Polling with Conditional Interval
**What:** Client polls faster during active provisioning, slower when stable
**When to use:** Balance between responsiveness and server load
**Example:**
```typescript
// Source: Existing src/components/dashboard/provisioning-status.tsx
// Already uses setInterval pattern, refine interval logic

useEffect(() => {
  fetchStatus();

  // Determine polling interval based on status
  const getInterval = () => {
    if (!instance) return 5000; // No instance: slow poll
    if (instance.status === "pending" || instance.status === "provisioning") {
      return 1000; // Active provisioning: fast poll (meets 5-second requirement with buffer)
    }
    if (instance.status === "stopping") {
      return 2000; // Stopping: medium poll
    }
    if (instance.status === "running") {
      return 5000; // Running: slow poll (just update uptime)
    }
    return 10000; // Stopped/failed: very slow poll
  };

  const interval = setInterval(() => {
    fetchStatus();
  }, getInterval());

  return () => clearInterval(interval);
}, [fetchStatus, instance?.status]);
```

### Anti-Patterns to Avoid

- **Storing step state only in memory:** Workflow callbacks update database, not just in-memory cache. If API server restarts, step progress must persist.
- **Fine-grained steps in workflow:** Don't add 20 callback steps for every Ansible task. Group into 4-5 major milestones that users care about (VM created, network configured, software installed, running).
- **Blocking callback requests:** Workflow callbacks should fire-and-forget. Don't fail the workflow if callback endpoint is temporarily down (use `|| true` in curl).
- **Overloading metadata field:** Store simple step identifiers ("vm_created"), not entire workflow state. Keep metadata lean.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Step state transitions | Custom state machine | Simple string field with mapping function | Workflow steps are linear, not complex FSM. String field + mapping logic sufficient. |
| Real-time push delivery | Custom WebSocket server | Client polling at 1-second interval | Polling meets 5-second latency requirement simply. SSE/WebSockets add operational complexity (connection state, scaling). |
| Database change notifications | Custom pub/sub system | Poll database via API endpoint | PostgreSQL LISTEN/NOTIFY elegant but over-engineered for single-user status checks. |
| Callback retry logic | Exponential backoff system | Fire-and-forget with best-effort delivery | Callbacks are status updates, not critical transactions. Missing one callback shows slightly stale UI, not data loss. |

**Key insight:** Real-time dashboards don't always need WebSockets. Polling at 1-second intervals provides 99th percentile latency under 2 seconds, meeting the 5-second requirement with large buffer. The added complexity of persistent connections, connection management, and scaling considerations only makes sense for sub-second latency requirements or thousands of concurrent users.

## Common Pitfalls

### Pitfall 1: Callback Handler Doesn't Update Step Progress
**What goes wrong:** Workflow sends granular step callbacks, but handler ignores the `step` field and only updates overall `status`. UI continues showing generic "Provisioning" state.

**Why it happens:** Callback handler code only checks for `status` field (provisioning/running/failed) and doesn't extract or store the `step` field.

**How to avoid:** Extend callback handler in `src/app/api/webhooks/github/route.ts` to call `updateProvisioningStep()` when `step` field is present in payload.

**Warning signs:** Workflow logs show step callbacks being sent, but database query shows `currentStep` remains null. UI shows static progress bar during provisioning.

### Pitfall 2: Step Mapping Doesn't Match Workflow Reality
**What goes wrong:** UI shows "Installing Dependencies" as active, but workflow has already moved to Ansible configuration. Step labels don't align with actual workflow stages.

**Why it happens:** `getProvisioningSteps()` mapping was designed before understanding actual workflow structure. Steps were guessed based on desired UI, not workflow reality.

**How to avoid:** Review workflow file (`.github/workflows/provision-agent.yml`) and map UI steps to actual workflow steps. Test with real provisioning run and verify step transitions match expectations.

**Warning signs:** User reports seeing "Creating Server" when VM already exists. Step transitions happen out of order or skip steps.

### Pitfall 3: Polling Interval Too Slow During Provisioning
**What goes wrong:** Component polls every 5 seconds, but workflow sends callbacks every second during critical steps. User sees 5-second delay in status updates, violating the "within 5 seconds" requirement.

**Why it happens:** Polling interval set conservatively to reduce server load, without considering status-dependent intervals.

**How to avoid:** Use dynamic polling interval (1s during provisioning, 5s when stable) as shown in Pattern 4 above.

**Warning signs:** User sees step progress "jump" several steps at once. Status feels laggy during provisioning but fine when stable.

### Pitfall 4: Race Condition Between Status and Step Updates
**What goes wrong:** Callback handler updates `status=running` and clears `currentStep`, but frontend still polling old data briefly shows "Provisioning - Ansible Complete" after agent is running.

**Why it happens:** Two separate database updates (status and step) in callback handler, or frontend caching stale data.

**How to avoid:** Update status and step fields atomically in single database transaction. Frontend should treat status=running as terminal state, ignoring currentStep field.

**Warning signs:** UI flickers between "Installing Dependencies" and "Running". Logs show status updated before step field cleared.

### Pitfall 5: Failed Steps Not Visible in UI
**What goes wrong:** Workflow fails at "Configure VM with Ansible" step, but UI shows generic "Provisioning failed" without indicating which step failed.

**Why it happens:** Failure callback doesn't include `failed_step` or `currentStep` in payload, or UI doesn't display this information.

**How to avoid:** Ensure failure callback includes step information. Update `getProvisioningSteps()` to mark failed step with "error" status. Display failed step name in error message.

**Warning signs:** User clicks retry without knowing what failed. Support team has to check workflow logs to debug, can't diagnose from dashboard.

## Code Examples

Verified patterns from existing codebase and best practices:

### Example 1: Enhanced Callback Handler
```typescript
// Source: Extend src/app/api/webhooks/github/route.ts
// Add step update handling to existing callback logic

export async function POST(request: Request) {
  // ... existing signature verification and payload parsing

  if (payload.type === "heartbeat") {
    await recordHeartbeat(payload.job_id);
    return NextResponse.json({ received: true });
  }

  if (payload.status) {
    // NEW: Handle step updates for status=provisioning with step field
    if (payload.status === "provisioning" && payload.step) {
      await updateProvisioningStep({
        jobId: payload.job_id,
        step: payload.step,
        metadata: payload.metadata || {},
      });
      console.log(`[GitHub Callback] Job ${payload.job_id} step: ${payload.step}`);
      return NextResponse.json({ received: true });
    }

    // Existing: Handle status transitions (running, failed)
    if (payload.status === "running" && payload.server_id && payload.server_ip) {
      await completeProvisioningWithMetadata({
        jobId: payload.job_id,
        metadata: {
          serverId: payload.server_id,
          serverIp: payload.server_ip,
          tailscaleIp: payload.tailscale_ip,
        },
      });
    } else {
      await updateJobStatus({
        jobId: payload.job_id,
        status: payload.status,
        error: payload.error,
        failedStep: payload.failed_step,
      });

      if (payload.status === "failed") {
        await rollbackFailedProvision(payload.job_id);
      }
    }

    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
}
```

### Example 2: Enhanced Instance API Response
```typescript
// Source: Extend src/app/api/agents/[id]/instance/route.ts
// Include step progress in response

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();

  // ... authentication and authorization checks

  const instance = await getProvisioningStatus(id);

  if (!instance) {
    return NextResponse.json({
      instance: null,
      steps: null,
      uptime: null,
    });
  }

  // Calculate uptime if running
  let uptime: number | null = null;
  if (instance.status === "running" && instance.startedAt) {
    uptime = Math.floor((Date.now() - new Date(instance.startedAt).getTime()) / 1000);
  }

  // NEW: Pass currentStep to getProvisioningSteps for dynamic derivation
  const steps = getProvisioningSteps(instance.status, instance.currentStep);

  return NextResponse.json({
    instance,
    steps,
    uptime,
  });
}
```

### Example 3: Migration to Add Step Fields
```typescript
// Source: Create new migration in drizzle migrations
// Add currentStep and stepMetadata fields to agentInstances

import { sql } from "drizzle-orm";
import { pgTable, text, jsonb } from "drizzle-orm/pg-core";

export async function up(db) {
  await db.execute(sql`
    ALTER TABLE agent_instances
    ADD COLUMN current_step TEXT,
    ADD COLUMN step_metadata JSONB DEFAULT '{}'::jsonb;
  `);
}

export async function down(db) {
  await db.execute(sql`
    ALTER TABLE agent_instances
    DROP COLUMN current_step,
    DROP COLUMN step_metadata;
  `);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard-coded step simulation | Real workflow step callbacks | This phase (Phase 10) | Users see actual progress instead of fake midpoint state |
| Single "provisioning" status | Granular step identifiers (vm_created, ansible_started) | This phase (Phase 10) | Debugging failures easier, users know what's happening |
| 5-second static polling | Status-dependent polling intervals | Best practice 2026 | Faster updates during provisioning, lower load when stable |
| WebSockets for all real-time | Polling for low-frequency updates, SSE/WS for high-frequency | Industry shift 2024-2026 | Simpler architecture, fewer connection issues |

**Deprecated/outdated:**
- **WebSocket-first for real-time:** WebSockets still valid for high-frequency bidirectional data (chat, collaborative editing), but overkill for one-way status updates with 5-second latency tolerance. SSE or polling preferred for simplicity.
- **PostgreSQL LISTEN/NOTIFY for small-scale apps:** LISTEN/NOTIFY elegant but requires persistent connections, adds complexity. Industry moved toward simpler polling for < 1000 users.
- **Separate status tables for denormalization:** Storing step state in separate table was common pattern, but JSONB metadata columns now preferred for flexibility without JOIN overhead.

## Open Questions

1. **Should step metadata include timestamps?**
   - What we know: Each callback includes a step identifier. Timestamps could show time spent in each step.
   - What's unclear: Whether users need this granularity, or if just knowing current step is sufficient.
   - Recommendation: Start without timestamps. Add if users request "how long did Ansible take?" type questions.

2. **Should failed step be preserved after retry?**
   - What we know: Retry creates a new job and instance. Old instance remains in database with status=failed.
   - What's unclear: Should UI show history of previous attempts and which step failed?
   - Recommendation: Keep failed instance records for debugging. Phase 11 (dashboard enhancements) can add retry history if needed.

3. **Should polling interval be configurable?**
   - What we know: Different status states need different polling frequencies.
   - What's unclear: Whether power users want control over polling rate.
   - Recommendation: Hard-code sensible defaults (1s provisioning, 5s running). Add configuration later only if users request it.

4. **Should we add Postgres indexes on currentStep field?**
   - What we know: API endpoint queries instances by agentId, orders by createdAt.
   - What's unclear: Whether querying/filtering by currentStep will be needed for analytics.
   - Recommendation: No index initially. Current query pattern (single instance per agent) doesn't need step filtering. Add if query patterns change.

## Sources

### Primary (HIGH confidence)
- Next.js 16.1.6 App Router documentation (route handlers, streaming)
- PostgreSQL 18 documentation (JSONB data type, UPDATE operations)
- Drizzle ORM 0.45.1 documentation (schema definition, migrations)
- Existing codebase: `.github/workflows/provision-agent.yml` (workflow structure)
- Existing codebase: `src/app/api/webhooks/github/route.ts` (callback handler pattern)
- Existing codebase: `src/components/dashboard/provisioning-status.tsx` (polling implementation)

### Secondary (MEDIUM confidence)
- [Implementing Server-Sent Events (SSE) in Node.js with Next.js](https://medium.com/@ammarbinshakir557/implementing-server-sent-events-sse-in-node-js-with-next-js-a-complete-guide-1adcdcb814fd) - SSE patterns in Next.js
- [Streaming in Next.js 15: WebSockets vs Server-Sent Events](https://hackernoon.com/streaming-in-nextjs-15-websockets-vs-server-sent-events) - Comparison of real-time approaches
- [Real-Time Web Communication: Polling, WebSockets, and SSE](https://medium.com/@brinobruno/real-time-web-communication-long-short-polling-websockets-and-sse-explained-next-js-code-958cd21b67fa) - Polling vs SSE tradeoffs
- [PostgreSQL LISTEN/NOTIFY for Real-Time Updates](https://www.pedroalonso.net/blog/postgres-listen-notify-real-time/) - Database-driven push patterns
- [How to Use Listen/Notify for Real-Time Updates in PostgreSQL](https://oneuptime.com/blog/post/2026-01-25-use-listen-notify-real-time-postgresql/view) - LISTEN/NOTIFY implementation guide

### Tertiary (LOW confidence)
- Generic polling best practices articles (various sources, not Next.js specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing dependencies (Next.js, PostgreSQL, Drizzle, React)
- Architecture: HIGH - Patterns derived from existing codebase (polling, callbacks, database schema)
- Pitfalls: MEDIUM-HIGH - Based on common async status UI issues, validated against workflow structure
- Step mapping: HIGH - Directly maps to provision-agent.yml workflow structure

**Research date:** 2026-02-13
**Valid until:** 60 days (patterns stable, no fast-moving dependencies)
