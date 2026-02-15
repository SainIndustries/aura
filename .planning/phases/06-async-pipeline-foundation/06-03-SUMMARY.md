---
phase: 06-async-pipeline-foundation
plan: 03
subsystem: infra
tags: [github-actions, webhooks, hmac, async-pipeline, provisioning]

# Dependency graph
requires:
  - phase: 06-01
    provides: "Database schema and job queue operations (updateJobStatus, recordHeartbeat)"
provides:
  - "GitHub Actions callback webhook endpoint with HMAC verification"
  - "GitHub Actions provisioning workflow with workflow_dispatch trigger"
  - "Async pipeline response path (callback -> database update)"
  - "Heartbeat mechanism for long-running operations"
affects: [06-04, 07, 08, provisioning-flow, stripe-webhook]

# Tech tracking
tech-stack:
  added: [github-actions, workflow_dispatch, openssl (HMAC in workflow)]
  patterns:
    - "HMAC signature verification with timingSafeEqual for webhook security"
    - "Background heartbeat loop in GitHub Actions with cleanup"
    - "Placeholder steps for phased implementation"

key-files:
  created:
    - src/app/api/webhooks/github/route.ts
    - .github/workflows/provision-agent.yml
  modified:
    - src/app/api/agents/__tests__/provision.test.ts
    - src/app/api/integrations/__tests__/integrations.test.ts
    - src/app/api/team/__tests__/team.test.ts

key-decisions:
  - "workflow_dispatch over repository_dispatch for typed inputs and better UI"
  - "15-minute workflow timeout (conservative for VM + Ansible + buffer)"
  - "60-second heartbeat interval matches GitHub Actions polling frequency"
  - "Separate success/failure callback steps with if: success() and if: failure()"
  - "Placeholder provisioning step for Phase 7-8 to implement"

patterns-established:
  - "Webhook callback pattern: HMAC verification -> parse payload -> update database -> return 200/401/400"
  - "GitHub Actions workflow pattern: provisioning callback -> heartbeat loop -> work -> cleanup -> success/failure callback"
  - "HMAC signature generation in bash: echo -n | openssl dgst -sha256 -hmac"

# Metrics
duration: 2.5min
completed: 2026-02-13
---

# Phase 06 Plan 03: GitHub Callback & Workflow Summary

**GitHub Actions async pipeline with HMAC-signed callbacks, heartbeat mechanism, and placeholder provisioning workflow ready for Phase 7-8 implementation**

## Performance

- **Duration:** 2 min 32 sec (152 seconds)
- **Started:** 2026-02-13T21:22:00Z
- **Completed:** 2026-02-13T21:24:32Z
- **Tasks:** 2
- **Files modified:** 5 (1 webhook endpoint + 1 workflow + 3 test fixes)

## Accomplishments
- GitHub Actions callback webhook endpoint verifies HMAC signatures and updates job status in database
- Provisioning workflow with workflow_dispatch trigger and 4 typed inputs (job_id, agent_id, region, callback_url)
- Background heartbeat loop (60s interval) with cleanup prevents timeout false positives
- Success/failure callbacks close the async pipeline loop (payment -> queue -> trigger -> callback -> database)
- Placeholder provisioning step ready for Phase 7 (Hetzner API) and Phase 8 (Ansible) to fill in

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub Actions callback webhook endpoint** - `23f41d6` (feat)
2. **Task 2: Create GitHub Actions provisioning workflow** - `50baa31` (feat)

## Files Created/Modified

### Created
- `src/app/api/webhooks/github/route.ts` - POST handler for GitHub Actions callbacks with HMAC verification, handles status updates and heartbeats
- `.github/workflows/provision-agent.yml` - Provisioning workflow with workflow_dispatch trigger, heartbeat loop, and placeholder VM provisioning step

### Modified (deviation fixes)
- `src/app/api/agents/__tests__/provision.test.ts` - Fixed null -> undefined in mock (TypeScript strict null check)
- `src/app/api/integrations/__tests__/integrations.test.ts` - Fixed null -> undefined in mocks (2 occurrences)
- `src/app/api/team/__tests__/team.test.ts` - Fixed null -> undefined in mocks (2 occurrences)

## Decisions Made

1. **workflow_dispatch over repository_dispatch** - Provides typed inputs, better GitHub UI, and explicit input validation (per research recommendation)
2. **15-minute workflow timeout** - Conservative estimate: VM creation ~2-3min + Ansible ~3-5min + buffer = 15min (matches Phase 06 Plan 01 timeout threshold)
3. **60-second heartbeat interval** - Matches GitHub Actions polling frequency and Phase 06 Plan 01 heartbeat constant
4. **Separate success/failure callback steps** - Using `if: success()` and `if: failure()` ensures exactly one terminal callback per workflow run
5. **Placeholder provisioning step** - Prints what Phase 7 and 8 will implement, allows testing async pipeline flow immediately

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing TypeScript test errors**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** 3 test files used `mockResolvedValue(null)` but TypeScript strict null checks expect `undefined` for optional return types (findFirst queries)
- **Fix:** Changed `null` to `undefined` in 5 mock statements across 3 test files
- **Files modified:**
  - src/app/api/agents/__tests__/provision.test.ts (1 occurrence)
  - src/app/api/integrations/__tests__/integrations.test.ts (2 occurrences)
  - src/app/api/team/__tests__/team.test.ts (2 occurrences)
- **Verification:** `npx tsc --noEmit` passes without errors
- **Committed in:** 23f41d6 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking issue - TypeScript compilation)
**Impact on plan:** Test fix was necessary to unblock TypeScript compilation. No impact on plan scope or functionality.

## Issues Encountered

None - plan executed smoothly with one pre-existing test issue auto-fixed.

## User Setup Required

**External services require manual configuration.**

### GitHub Repository Secrets

User must add the following secret to the GitHub repository:

1. **GITHUB_CALLBACK_SECRET** - Shared secret for HMAC signature verification
   - Navigate to GitHub repository Settings > Secrets and variables > Actions > New repository secret
   - Name: `GITHUB_CALLBACK_SECRET`
   - Value: Generate a secure random string (e.g., `openssl rand -hex 32`)
   - This MUST match the `GITHUB_CALLBACK_SECRET` environment variable in Vercel

### Vercel Environment Variable

User must add the following environment variable to Vercel:

1. **GITHUB_CALLBACK_SECRET** - Same value as GitHub repository secret
   - Navigate to Vercel project Settings > Environment Variables
   - Name: `GITHUB_CALLBACK_SECRET`
   - Value: Same secure random string from GitHub secret
   - Environments: Production, Preview, Development (select all)

### Verification

After configuration, verify webhook endpoint responds correctly:

```bash
# Test invalid signature (should return 401)
curl -X POST https://your-domain.vercel.app/api/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-Signature: invalid" \
  -d '{"job_id":"test-job","status":"provisioning"}'

# Expected: {"error":"Invalid signature"}
```

## Next Phase Readiness

**Ready for Phase 06 Plan 04** - The async pipeline response path is complete. Next step is to build the trigger mechanism (06-04: Stripe webhook integration and GitHub Actions trigger).

**Workflow testing available** - Can manually trigger workflow via GitHub UI to test heartbeat and callback flow with placeholder provisioning step.

**Phase 7 preparation** - Placeholder provisioning step clearly documents what Phase 7 must implement (Hetzner API VM creation).

**Phase 8 preparation** - Placeholder provisioning step clearly documents what Phase 8 must implement (Ansible configuration).

## Self-Check: PASSED

All claims verified:
- FOUND: src/app/api/webhooks/github/route.ts
- FOUND: .github/workflows/provision-agent.yml
- FOUND: 23f41d6 (Task 1 commit)
- FOUND: 50baa31 (Task 2 commit)

---
*Phase: 06-async-pipeline-foundation*
*Completed: 2026-02-13*
