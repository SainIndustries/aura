---
phase: 09-lifecycle-management
verified: 2026-02-13T23:15:00Z
status: passed
score: 5/5 truths verified
re_verification: false
---

# Phase 09: Lifecycle Management Verification Report

**Phase Goal:** Users can control agent state and system handles subscription lifecycle  
**Verified:** 2026-02-13T23:15:00Z  
**Status:** PASSED  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can stop running agent from dashboard (VM shuts down, data preserved) | ✓ VERIFIED | API route `/api/agents/[id]/stop` calls `stopAgent()` which executes `shutdownServer()` with graceful shutdown + 60s timeout fallback to poweroff. Database updated to "stopped" status, stoppedAt timestamp set. Agent status → "paused". |
| 2 | User can restart stopped agent from dashboard (VM starts, agent resumes) | ✓ VERIFIED | API route `/api/agents/[id]/start` calls `startAgent()` which executes `powerOnServer()`. Database updated to "running" status, startedAt set, stoppedAt cleared. Agent status → "active". |
| 3 | System automatically destroys VM and removes Tailscale device when subscription is cancelled | ✓ VERIFIED | Stripe webhook `customer.subscription.deleted` handler queries all running agents for user, calls `destroyAgent()` for each. `destroyAgent()` deletes Hetzner server via `deleteServer()` and Tailscale device via `findDeviceByIp()` + `deleteDevice()`. Both operations idempotent (404 = success). |
| 4 | System rolls back partial provisions on failure (deletes orphaned VMs automatically) | ✓ VERIFIED | Dual-layer rollback: (1) Workflow step "Cleanup orphaned VM on failure" runs on `failure()` with direct Hetzner DELETE API call (lines 162-179). (2) GitHub callback handler calls `rollbackFailedProvision()` on `status === "failed"` (lines 94-106) which deletes Hetzner VM and Tailscale device, tracks cleanup results in DB. |
| 5 | System suspends agent on payment failure without destroying data | ✓ VERIFIED | Stripe webhook `invoice.payment_failed` handler queries all running agents for user, calls `stopAgent()` for each (not `destroyAgent()`). VM is shut down but server and data preserved. Agent status → "paused". |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/provisioning/lifecycle.ts` | Lifecycle orchestrator with stopAgent, startAgent, destroyAgent, rollbackFailedProvision | ✓ VERIFIED | 297 lines, 4 exported async functions. Implements atomic state transitions with rollback on failure. Error-tolerant cleanup. |
| `src/lib/hetzner.ts` | Power management functions (shutdownServer, powerOnServer, powerOffServer) | ✓ VERIFIED | 7 exported async functions (4 existing + 3 new). `shutdownServer` has graceful-to-forced fallback. `deleteServer` made idempotent (404 = success). |
| `src/lib/tailscale.ts` | Device management functions (listDevices, deleteDevice, findDeviceByIp) | ✓ VERIFIED | 6 exported async functions (3 existing + 3 new). `deleteDevice` idempotent (404 = success). |
| `src/app/api/agents/[id]/stop/route.ts` | Real VM shutdown via lifecycle orchestrator | ✓ VERIFIED | Imports `stopAgent`, checks for serverId, calls lifecycle function. Backward compatible (DB-only update if no serverId). |
| `src/app/api/agents/[id]/start/route.ts` | Real VM power-on via lifecycle orchestrator | ✓ VERIFIED | Imports `startAgent`, checks for serverId, calls lifecycle function. Backward compatible. |
| `src/app/api/agents/[id]/destroy/route.ts` | Agent destruction endpoint | ✓ VERIFIED | New file created. Imports `destroyAgent`, handles full cleanup of Hetzner VM + Tailscale device. Audit log with "agent_destroyed" action. |
| `src/app/api/webhooks/stripe/route.ts` | Subscription lifecycle handlers (cancellation, payment failure) | ✓ VERIFIED | Imports `destroyAgent` and `stopAgent`. Separate cases for `subscription.deleted` (destroy) and `payment_failed` (suspend). Loops through user agents, error-tolerant (continue on failure). |
| `src/app/api/webhooks/github/route.ts` | Rollback trigger on provision failure | ✓ VERIFIED | Imports `rollbackFailedProvision`. Calls rollback on `status === "failed"` (lines 94-106). Best-effort (logs errors, doesn't fail callback). |
| `.github/workflows/provision-agent.yml` | Rollback step for VM cleanup on failure | ✓ VERIFIED | "Cleanup orphaned VM on failure" step at lines 162-179 with `if: failure() && steps.provision.outputs.server_id != ''`. Idempotent deletion (404 OK). Failure callback includes server_id, server_ip, tailscale_ip (lines 195-197). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `lifecycle.ts` | `hetzner.ts` | Import shutdownServer, powerOnServer, deleteServer | ✓ WIRED | Line 6: `import { shutdownServer, powerOnServer, deleteServer } from "../hetzner";` — Used in stopAgent (line 47), startAgent (line 112), destroyAgent (line 172), rollbackFailedProvision (line 255). |
| `lifecycle.ts` | `tailscale.ts` | Import deleteDevice, findDeviceByIp | ✓ WIRED | Line 7: `import { deleteDevice, findDeviceByIp } from "../tailscale";` — Used in destroyAgent (lines 185-187), rollbackFailedProvision (lines 267-269). |
| `lifecycle.ts` | `@/lib/db/schema` | Import agentInstances, agents, provisioningJobs | ✓ WIRED | Line 9: `import { agentInstances, agents, provisioningJobs } from "@/lib/db/schema";` — Used throughout for state transitions. |
| `stop/route.ts` | `lifecycle.ts` | Import stopAgent | ✓ WIRED | Line 6: `import { stopAgent } from "@/lib/provisioning/lifecycle";` — Called at line 46. |
| `start/route.ts` | `lifecycle.ts` | Import startAgent | ✓ WIRED | Line 6: `import { startAgent } from "@/lib/provisioning/lifecycle";` — Called at line 46. |
| `destroy/route.ts` | `lifecycle.ts` | Import destroyAgent | ✓ WIRED | Line 6: `import { destroyAgent } from "@/lib/provisioning/lifecycle";` — Called at line 36. |
| `stripe/route.ts` | `lifecycle.ts` | Import destroyAgent, stopAgent | ✓ WIRED | Import at top of file. `destroyAgent` called in subscription.deleted handler. `stopAgent` called in payment_failed handler. |
| `github/route.ts` | `lifecycle.ts` | Import rollbackFailedProvision | ✓ WIRED | Line 1: `import { rollbackFailedProvision } from "@/lib/provisioning/lifecycle";` — Called at line 96 on status === "failed". |
| `provision-agent.yml` | `github/route.ts` | Failure callback with server_id triggers rollback | ✓ WIRED | Workflow sends server_id in failure callback (lines 195-197). GitHub callback receives it and passes to `rollbackFailedProvision(job_id)`. |

### Requirements Coverage

No REQUIREMENTS.md entries mapped to Phase 09 in ROADMAP.md. Phase success criteria defined at roadmap level.

### Anti-Patterns Found

**None detected.**

Verification scanned all modified files for:
- TODO/FIXME/placeholder comments: None found
- Empty implementations (return null/{}): None found
- Console.log-only functions: None found
- Stub patterns: None found

All functions have substantive implementations with proper error handling, logging, and state management.

### Human Verification Required

#### 1. End-to-End Stop/Start Flow

**Test:** 
1. Provision an agent with real infrastructure (Hetzner VM + Tailscale)
2. From dashboard, click "Stop Agent"
3. Wait for status to update to "Paused"
4. Verify VM is powered off in Hetzner console (not deleted)
5. Click "Start Agent"
6. Wait for status to update to "Active"
7. Verify VM is powered on and agent process resumed

**Expected:** 
- Stop: VM gracefully shuts down within 60s, or forced poweroff if timeout. Database shows "stopped" status with stoppedAt timestamp. Agent accessible via Tailscale IP after restart.
- Start: VM powers on, agent process resumes, becomes active. Database shows "running" status with updated startedAt.

**Why human:** 
- Requires live Hetzner account and provisioned VM
- Tests real API interactions, not just code paths
- Verifies graceful shutdown timeout behavior
- Confirms agent process auto-resumes after VM restart

#### 2. Subscription Cancellation Cleanup

**Test:**
1. User has active subscription with provisioned agent
2. Cancel subscription via Stripe dashboard or API
3. Observe webhook processing

**Expected:**
- Webhook receives `customer.subscription.deleted` event
- System queries all running agents for user
- For each agent with infrastructure: `destroyAgent()` called
- Hetzner VM deleted (verify in Hetzner console)
- Tailscale device removed (verify in Tailscale admin)
- Database shows instance status "stopped" with error "Destroyed via lifecycle management"

**Why human:**
- Requires live Stripe webhook setup
- Tests external service integrations (Hetzner, Tailscale APIs)
- Verifies idempotent cleanup (can re-run without errors)
- Confirms no orphaned resources remain

#### 3. Payment Failure Suspension

**Test:**
1. User has active subscription with provisioned agent
2. Trigger payment failure (test mode card decline)
3. Observe webhook processing

**Expected:**
- Webhook receives `invoice.payment_failed` event
- System queries all running agents for user
- For each agent: `stopAgent()` called (NOT `destroyAgent()`)
- Hetzner VM powered off but still exists in Hetzner console
- Tailscale device remains in network (offline)
- Database shows instance status "stopped" (not "failed")
- Agent can be restarted when payment issue resolved

**Why human:**
- Tests distinction between suspend (stop) and destroy
- Verifies data preservation during payment grace period
- Requires live Stripe webhook + test payment failure
- Confirms recovery path exists (restart after payment fixed)

#### 4. Provision Failure Rollback

**Test:**
1. Trigger provision failure (e.g., intentionally break Ansible playbook)
2. Observe GitHub Actions workflow
3. Check Hetzner console and Tailscale admin

**Expected:**
- Workflow step "Cleanup orphaned VM on failure" runs
- Direct DELETE API call to Hetzner succeeds (or 404 if already cleaned)
- GitHub callback sends failure with server_id metadata
- `rollbackFailedProvision()` called by callback handler
- Hetzner VM deleted (if not already by workflow step)
- Tailscale device removed
- Database shows instance status "failed" with cleanup summary

**Why human:**
- Tests dual-layer rollback (workflow + callback)
- Requires triggering real provision failure
- Verifies no orphaned VMs accumulate costs
- Tests idempotency (both cleanup layers safe to run)

---

## Summary

**Phase 09 goal ACHIEVED.**

All 5 observable truths verified through code analysis:
1. ✓ Stop agent via dashboard → real VM shutdown
2. ✓ Start agent via dashboard → real VM power-on
3. ✓ Subscription cancelled → VMs destroyed + Tailscale cleanup
4. ✓ Provision failure → automatic rollback (dual-layer)
5. ✓ Payment failure → agent suspended (data preserved)

**Artifacts:** All 9 required files exist with substantive implementations.

**Wiring:** All 9 key links verified — lifecycle orchestrator fully integrated with API routes, webhooks, and workflow.

**Code quality:** No anti-patterns, stubs, or placeholders detected. TypeScript compiles without errors. All operations idempotent (404 = success). Error handling comprehensive with rollback strategies.

**Human verification needed:** 4 tests requiring live infrastructure, external service integrations, and workflow execution. Critical for production confidence but not blockers for phase completion.

**Next steps:**
- Phase 10: Status Integration (dashboard shows real-time provisioning progress)
- Production deployment verification (run human tests in staging)
- Monitoring setup for lifecycle operations (track cleanup success rates)

---

_Verified: 2026-02-13T23:15:00Z_  
_Verifier: Claude (gsd-verifier)_
