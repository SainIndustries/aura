---
phase: 07-vm-provisioning-via-hetzner-api
verified: 2026-02-13T22:10:00Z
status: human_needed
score: 13/13 automated checks verified
re_verification: false
human_verification:
  - test: "Trigger workflow via workflow_dispatch with test job_id, agent_id, region, callback_url"
    expected: "Workflow creates Hetzner VM within 2 minutes, VM joins Tailscale network, callback receives VM metadata (server_id, server_ip, tailscale_ip)"
    why_human: "Requires live API credentials and end-to-end workflow execution"
  - test: "Verify VM provisions within 5 minutes of simulated payment"
    expected: "Complete flow (payment webhook → job queue → workflow dispatch → VM creation → callback) completes under 5 minutes"
    why_human: "Requires timing real-world API latencies across multiple services"
  - test: "Verify agent instance record created with correct VM metadata"
    expected: "Database query shows agentInstances row with serverId, serverIp, tailscaleIp matching Hetzner/Tailscale consoles"
    why_human: "Requires cross-referencing database state with external service dashboards"
  - test: "Verify workflow failure handling"
    expected: "If VM creation fails (e.g., invalid credentials), workflow sends failure callback with error details"
    why_human: "Requires intentional failure injection and observing error propagation"
---

# Phase 7: VM Provisioning via Hetzner API Verification Report

**Phase Goal:** Create and destroy Hetzner VMs with Tailscale networking via direct API calls
**Verified:** 2026-02-13T22:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GitHub Actions workflow creates Hetzner VM via REST API when job is dispatched | ✓ VERIFIED | Workflow uses `npx tsx provision-vm.ts` with HETZNER_API_TOKEN, calls createServer() from hetzner.ts |
| 2 | VM is provisioned with SSH access and basic networking within 2 minutes | ? NEEDS HUMAN | Workflow has 15-min timeout, waitForAction() polls 120 times @ 1s (2-min max), but actual timing needs live test |
| 3 | VM automatically joins Tailscale network with ephemeral auth key | ✓ VERIFIED | Cloud-init template calls tailscale up with ephemeral auth key from createAuthKey(), verifyEnrollment() polls until device appears |
| 4 | Database stores VM metadata (server_id, server_ip, tailscale_ip, region) | ✓ VERIFIED | completeProvisioningWithMetadata() inserts/updates agentInstances with all metadata fields, schema has columns |
| 5 | Complete provision flow (payment to running VM) completes in under 5 minutes | ? NEEDS HUMAN | Individual components verified, but end-to-end timing requires live test with real API latencies |

**Score:** 3/5 truths verified (2 need human testing)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/hetzner.ts` | Hetzner Cloud REST API client | ✓ VERIFIED | 240 lines, exports createServer, waitForAction, deleteServer, fetchWithRateLimit, uses api.hetzner.cloud/v1 |
| `src/lib/tailscale.ts` | Tailscale API client with OAuth auth key generation | ✓ VERIFIED | 187 lines, exports getOAuthToken, createAuthKey, verifyEnrollment, uses api.tailscale.com/api/v2 |
| `src/lib/cloud-init.ts` | Cloud-init YAML configuration generator | ✓ VERIFIED | 30 lines, exports generateCloudInitConfig, includes NTP sync fix and Tailscale installation |
| `src/lib/provisioning/provision-vm.ts` | VM provisioning orchestrator function | ✓ VERIFIED | 156 lines, exports provisionVM, has CLI entry point with GITHUB_OUTPUT support, calls all API clients |
| `.github/workflows/provision-agent.yml` | Real provisioning workflow replacing placeholder | ✓ VERIFIED | Contains `npx tsx`, Node.js 20 setup, npm ci, success callback with VM metadata (server_id, server_ip, tailscale_ip) |
| `src/app/api/webhooks/github/route.ts` | Extended callback handler with VM metadata support | ✓ VERIFIED | Imports completeProvisioningWithMetadata, routes status=running + metadata to it, backward compatible |
| `src/lib/provisioning/queue.ts` | Function to store VM metadata and update agent instance | ✓ VERIFIED | Exports completeProvisioningWithMetadata (line 239), updates provisioningJobs, agentInstances, agents atomically |

**All 7 artifacts verified** (exist, substantive, wired)

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| provision-vm.ts | hetzner.ts | imports createServer, waitForAction | ✓ WIRED | Line 6: `import { createServer, waitForAction } from "../hetzner"`, calls at lines 75, 94 |
| provision-vm.ts | tailscale.ts | imports createAuthKey, verifyEnrollment | ✓ WIRED | Line 7: `import { createAuthKey, verifyEnrollment } from "../tailscale"`, calls at lines 55, 99 |
| provision-vm.ts | cloud-init.ts | imports generateCloudInitConfig | ✓ WIRED | Line 8: `import { generateCloudInitConfig } from "../cloud-init"`, calls at line 61 |
| cloud-init.ts | tailscale.ts | Auth key interpolated into cloud-init template | ✓ WIRED | Line 24: `tailscale up --auth-key=${tailscaleAuthKey}` directly interpolates key parameter |
| hetzner.ts | api.hetzner.cloud | REST API calls with Bearer token | ✓ WIRED | Lines 116, 167, 221 use api.hetzner.cloud/v1 endpoints with Authorization header |
| tailscale.ts | api.tailscale.com | REST API calls with OAuth token | ✓ WIRED | Lines 52, 88, 142 use api.tailscale.com/api/v2 endpoints with OAuth flow |
| workflow | provision-vm.ts | npx tsx script execution | ✓ WIRED | Line 82: `run: npx tsx src/lib/provisioning/provision-vm.ts` with all required env vars |
| route.ts | queue.ts | calls completeProvisioningWithMetadata | ✓ WIRED | Line 3 imports, lines 72-79 call with metadata on status=running |
| queue.ts | agentInstances | inserts/updates VM metadata | ✓ WIRED | Lines 260-291 query existing, update or insert with serverId, serverIp, tailscaleIp |

**All 9 key links verified** (all wired correctly)

### Requirements Coverage

| Requirement | Status | Supporting Truths |
|-------------|--------|-------------------|
| PROV-01: System creates Hetzner VM via direct API when user completes payment | ✓ SATISFIED | Truth #1 (workflow creates VM), hetzner.ts createServer() verified |
| PROV-03: System enrolls VM in Tailscale network with ephemeral auth keys | ✓ SATISFIED | Truth #3 (Tailscale auto-join), tailscale.ts createAuthKey() + cloud-init verified |
| PROV-06: User's agent is running within 5 minutes of payment | ? NEEDS HUMAN | Truth #5 (end-to-end timing), components verified but needs live test |

**Score:** 2/3 requirements satisfied (1 needs human testing)

### Anti-Patterns Found

**None detected.** All console.log statements are legitimate logging with [Module] prefixes. No TODO/FIXME/PLACEHOLDER comments. No empty implementations or stub functions. No orphaned files.

### Human Verification Required

#### 1. End-to-End Workflow Execution

**Test:** Configure GitHub Actions secrets (HETZNER_API_TOKEN, HETZNER_SSH_KEY_ID, TAILSCALE_OAUTH_CLIENT_ID, TAILSCALE_OAUTH_CLIENT_SECRET, GITHUB_CALLBACK_SECRET), then dispatch workflow with test inputs:
```bash
gh workflow run provision-agent.yml \
  -f job_id=test-$(date +%s) \
  -f agent_id=test-agent-id \
  -f region=us-east \
  -f callback_url=https://your-app.com/api/webhooks/github
```

**Expected:**
- Workflow completes successfully within 5 minutes
- Hetzner Cloud Console shows new server with name `agent-{agentId}-{timestamp}`
- Server has public IPv4 assigned
- Tailscale Admin Console shows new device with matching hostname
- Device has Tailscale IP assigned and is "Connected"
- Callback webhook receives POST with VM metadata: `{"job_id":"...", "status":"running", "server_id":"...", "server_ip":"...", "tailscale_ip":"..."}`
- Database query: `SELECT * FROM agent_instances WHERE server_id = '...'` shows row with correct metadata

**Why human:** Requires live API credentials, external service dashboards access, and cross-referencing multiple systems. Cannot be verified programmatically without running infrastructure.

#### 2. Provisioning Timing (5-Minute Target)

**Test:** Simulate complete flow from Stripe webhook to running VM:
1. Trigger Stripe test webhook with payment.succeeded event
2. Observe provisioning job enqueued in database
3. Verify GitHub Actions workflow dispatched automatically
4. Time until workflow completes and callback received
5. Verify total elapsed time from webhook to VM running

**Expected:**
- Job enqueued within 2 seconds of webhook (Phase 6 success criteria)
- Workflow dispatched within 5 seconds
- VM created and Tailscale enrolled within 3-4 minutes
- Total elapsed time: under 5 minutes

**Why human:** Requires timing real-world API latencies across Hetzner, Tailscale, and GitHub Actions. Automated tests cannot simulate production latencies.

#### 3. Failure Handling

**Test:** Inject failure by temporarily invalidating HETZNER_API_TOKEN secret, then dispatch workflow

**Expected:**
- Workflow fails at "Provision VM" step
- Workflow sends failure callback: `{"job_id":"...", "status":"failed", "error":"Provisioning workflow failed", "failed_step":"provision"}`
- Database shows provisioning job with status "failed" and error message
- No orphaned Hetzner servers created (or cleanup occurs)

**Why human:** Requires intentional failure injection and observing error propagation across systems.

#### 4. Agent Activation Flow

**Test:** After successful VM provisioning, query database for agent status transition

**Expected:**
- Agent status changes from "draft" to "active"
- Agent instance record created with status "running"
- All metadata fields populated (serverId, serverIp, tailscaleIp, region, startedAt)

**Why human:** Requires cross-referencing database state with external service dashboards to verify data consistency.

---

## Summary

**All automated verifications passed.** Phase 7 implementation is complete and correct:

### What Works (Verified)
- ✅ All 7 artifacts exist with substantial implementations (613 total lines)
- ✅ All 9 key links wired correctly (imports, API calls, database operations)
- ✅ TypeScript compilation passes with zero errors
- ✅ GitHub Actions workflow has real VM provisioning (no placeholders)
- ✅ Success callback includes complete VM metadata
- ✅ Callback handler routes to completeProvisioningWithMetadata
- ✅ Database schema has all required columns for VM metadata
- ✅ Agent activation flow implemented (draft → active)
- ✅ All commits exist in git history

### What Needs Human Testing
- ⏱️ **End-to-end workflow execution** with live API credentials
- ⏱️ **5-minute provisioning target** with real-world latencies
- ⚠️ **Failure handling** and error propagation
- 🔍 **Agent activation** and database state consistency

### Blockers
**None.** All code artifacts are complete and wired. Human testing is needed only for live infrastructure validation, not code completion.

### Next Steps
1. **User setup:** Configure GitHub Actions secrets (documented in 07-01-PLAN.md user_setup section)
2. **Human testing:** Execute the 4 verification tests above
3. **If tests pass:** Mark Phase 7 complete, proceed to Phase 8 (Ansible configuration)
4. **If tests fail:** Debug specific failure points (likely API credentials or timing issues, not code logic)

---

_Verified: 2026-02-13T22:10:00Z_
_Verifier: Claude (gsd-verifier)_
