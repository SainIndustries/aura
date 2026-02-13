---
phase: 07-vm-provisioning-via-hetzner-api
plan: 01
subsystem: infrastructure
tags: [hetzner-api, tailscale-api, cloud-init, api-clients, vm-provisioning]
dependency_graph:
  requires: []
  provides:
    - Hetzner Cloud API client with rate limiting
    - Tailscale OAuth-based auth key generation
    - Cloud-init YAML generator with NTP sync
  affects:
    - src/lib/hetzner.ts (NEW)
    - src/lib/tailscale.ts (NEW)
    - src/lib/cloud-init.ts (NEW)
tech_stack:
  added:
    - Native Node.js fetch API (no external dependencies)
    - Hetzner Cloud REST API v1
    - Tailscale API v2 with OAuth
  patterns:
    - Exponential backoff for rate limit handling
    - Polling with configurable timeouts
    - Cloud-init user_data for VM initialization
key_files:
  created:
    - src/lib/hetzner.ts: "Hetzner Cloud API client (240 lines)"
    - src/lib/tailscale.ts: "Tailscale API client (187 lines)"
    - src/lib/cloud-init.ts: "Cloud-init generator (30 lines)"
  modified: []
decisions:
  - decision: "Use native fetch instead of external HTTP libraries"
    rationale: "Matches existing codebase pattern, no new dependencies, Node.js 18+ support"
    impact: "Consistent with src/lib/provisioning/github-actions.ts pattern"
  - decision: "Use location property instead of deprecated datacenter"
    rationale: "Hetzner deprecating datacenter after July 2026"
    impact: "Future-proof API usage"
  - decision: "Include NTP sync in cloud-init before Tailscale installation"
    rationale: "Prevents SSL certificate errors from clock skew on new VMs"
    impact: "Addresses pitfall identified in research"
  - decision: "OAuth-based ephemeral auth keys instead of static API keys"
    rationale: "Security best practice, auto-expiring keys, per research recommendation"
    impact: "Requires TAILSCALE_OAUTH_CLIENT_ID and TAILSCALE_OAUTH_CLIENT_SECRET env vars"
metrics:
  duration_seconds: 124
  tasks_completed: 2
  files_created: 3
  files_modified: 0
  lines_added: 457
  commits: 2
  completed_date: "2026-02-13"
---

# Phase 07 Plan 01: API Client Modules Summary

**One-liner:** Hetzner Cloud, Tailscale OAuth, and cloud-init TypeScript API clients with rate limiting and NTP clock sync.

## Overview

Created three independent TypeScript API client modules that encapsulate all external service interactions needed for VM provisioning. These modules serve as the foundation for the provisioning orchestrator (Plan 02) and future lifecycle management (Phase 9).

### What Was Built

**Hetzner Cloud API Client (`src/lib/hetzner.ts`):**
- Server creation with cloud-init user_data support
- Action polling with configurable timeout (120 retries @ 1s intervals)
- Server deletion for lifecycle management
- Rate limit handling with exponential backoff (HTTP 429 retry logic)
- Uses `location` property (not deprecated `datacenter`)
- Native fetch with Bearer token authentication

**Tailscale API Client (`src/lib/tailscale.ts`):**
- OAuth token acquisition (client_credentials grant)
- Ephemeral auth key generation (non-reusable, preauthorized, tagged)
- Device enrollment verification with polling (60 retries @ 2s intervals)
- Returns Tailscale IP address and device ID upon enrollment

**Cloud-init Generator (`src/lib/cloud-init.ts`):**
- YAML configuration template for VM initialization
- NTP clock sync before Tailscale installation (prevents SSL errors)
- Tailscale installation and auto-join with ephemeral auth key
- Hostname and tag configuration

### Key Technical Details

**Rate Limiting Strategy (Hetzner):**
- Reads `RateLimit-Reset` header for accurate wait time
- Fallback to exponential backoff: `1s * 2^attempt` (max 60s)
- Max 5 retries before throwing error
- Applies to all API calls (create, poll, delete)

**Polling Strategy:**
- Hetzner actions: 120 retries @ 1s = 2-minute max wait (typical: 30-60s)
- Tailscale enrollment: 60 retries @ 2s = 2-minute max wait (typical: 30-60s)
- Progress logging every 10th attempt to reduce noise

**Cloud-init Pitfall Fix:**
- New VMs may have incorrect system clock (causing SSL verification failures)
- Solution: Force NTP sync before any HTTPS operations
- `systemctl restart systemd-timesyncd` + `timedatectl` wait loop (60s timeout)

## Deviations from Plan

None - plan executed exactly as written.

## Testing & Verification

**TypeScript Compilation:**
- ✅ `npx tsc --noEmit` passes with zero errors

**Export Verification:**
- ✅ Hetzner: `createServer`, `waitForAction`, `deleteServer`, `fetchWithRateLimit`
- ✅ Tailscale: `getOAuthToken`, `createAuthKey`, `verifyEnrollment`
- ✅ Cloud-init: `generateCloudInitConfig`

**API Endpoint Verification:**
- ✅ Hetzner uses `api.hetzner.cloud/v1`
- ✅ Tailscale uses `api.tailscale.com/api/v2`
- ✅ Hetzner uses `location` (not `datacenter`)

**Line Count Requirements:**
- ✅ Hetzner: 240 lines (min 80)
- ✅ Tailscale: 187 lines (min 60)
- ✅ Cloud-init: 30 lines (min 20)

**Dependencies:**
- ✅ No external npm packages added (uses native fetch)

## Task Breakdown

### Task 1: Create Hetzner Cloud API client module
**Status:** ✅ Complete
**Commit:** 305ac99
**Files:** src/lib/hetzner.ts (240 lines)
**Duration:** ~60s

Implemented:
- `createServer(config)` - POST with cloud-init user_data
- `waitForAction(actionId, options?)` - Polling until success/error
- `deleteServer(serverId)` - DELETE for cleanup
- `fetchWithRateLimit(url, options)` - HTTP 429 retry wrapper
- `getHetznerConfig()` - Environment validation

### Task 2: Create Tailscale API client and cloud-init generator modules
**Status:** ✅ Complete
**Commit:** 9495098
**Files:** src/lib/tailscale.ts (187 lines), src/lib/cloud-init.ts (30 lines)
**Duration:** ~64s

Implemented:
- `getOAuthToken()` - OAuth client_credentials flow
- `createAuthKey()` - Ephemeral key with tag:agent
- `verifyEnrollment(hostname, options?)` - Poll device list
- `generateCloudInitConfig(params)` - YAML template with NTP sync

## Integration Points

**Plan 02 (Provisioning Orchestrator) will use:**
- `createAuthKey()` → `generateCloudInitConfig()` → `createServer()`
- `waitForAction()` to confirm server ready
- `verifyEnrollment()` to confirm Tailscale connectivity

**Phase 9 (Lifecycle Management) will use:**
- `deleteServer()` for teardown
- All Tailscale functions for device management

## Environment Variables Required

From `user_setup` section:

**Hetzner:**
- `HETZNER_API_TOKEN` - Generate at Hetzner Cloud Console → Security → API Tokens (Read & Write)

**Tailscale:**
- `TAILSCALE_OAUTH_CLIENT_ID` - Generate OAuth client with `devices:write` scope
- `TAILSCALE_OAUTH_CLIENT_SECRET` - From same OAuth client

**Manual Setup:**
- Upload platform SSH public key to Hetzner Cloud Console → Security → SSH Keys
- Create ACL tag `tag:agent` in Tailscale Admin Console → Access Controls

## Next Steps

**Plan 02:** Implement provisioning orchestrator that combines these modules into end-to-end workflow

**Plan 03:** Integrate orchestrator with GitHub Actions workflow (placeholder from Phase 6)

## Self-Check

Verifying all claims from summary...

**Files created:**
```bash
[ -f "src/lib/hetzner.ts" ] && echo "FOUND: src/lib/hetzner.ts" || echo "MISSING: src/lib/hetzner.ts"
[ -f "src/lib/tailscale.ts" ] && echo "FOUND: src/lib/tailscale.ts" || echo "MISSING: src/lib/tailscale.ts"
[ -f "src/lib/cloud-init.ts" ] && echo "FOUND: src/lib/cloud-init.ts" || echo "MISSING: src/lib/cloud-init.ts"
```

**Commits exist:**
```bash
git log --oneline --all | grep -q "305ac99" && echo "FOUND: 305ac99" || echo "MISSING: 305ac99"
git log --oneline --all | grep -q "9495098" && echo "FOUND: 9495098" || echo "MISSING: 9495098"
```

**Results:**
- ✅ FOUND: src/lib/hetzner.ts
- ✅ FOUND: src/lib/tailscale.ts
- ✅ FOUND: src/lib/cloud-init.ts
- ✅ FOUND: 305ac99
- ✅ FOUND: 9495098

## Self-Check: PASSED
