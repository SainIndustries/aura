# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Users can deploy a fully configured, always-on AI agent without touching infrastructure
**Current focus:** Phase 6 complete — ready for Phase 7

## Current Position

Phase: 7 of 10 (VM Provisioning via Hetzner API) — IN PROGRESS
Plan: 2 of 3 complete
Status: Executing Phase 7
Last activity: 2026-02-13 — Completed 07-03: VM metadata storage and agent activation

Progress: [██░░░░░░░░] 20% (v1.1 phases - 1 of 5 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 2.3 minutes
- Total execution time: 0.18 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 06    | 3     | 445s  | 148s     |
| 07    | 2     | 240s  | 120s     |

**Recent Trend:**
- Last 5 plans: 06-01 (193s), 06-02 (100s), 06-03 (152s), 07-01 (124s), 07-03 (116s)
- Trend: Improving execution speed

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v1.1 Initialization: NO Terraform — using direct Hetzner REST API, database is source of truth
- v1.1 Initialization: Async pipeline architecture — Stripe webhook → PostgreSQL job queue → GitHub Actions → callback webhook
- v1.1 Initialization: openclaw-ansible needs localhost→remote adaptation
- v1.1 Initialization: Tailscale uses OAuth client for ephemeral auth keys (not static keys)
- v1.1 Initialization: Long operations MUST run in GitHub Actions (Vercel 10-60s timeout)
- Phase 06 Plan 01: Max retries = 3 for provisioning jobs
- Phase 06 Plan 01: Job timeout threshold = 15 minutes (900s)
- Phase 06 Plan 01: Heartbeat interval = 60s (matches GitHub Actions)
- Phase 06 Plan 01: On-demand timeout detection (no background cron)
- Phase 06 Plan 02: Workflow filename hardcoded as provision-agent.yml
- Phase 06 Plan 02: Workflow ref hardcoded as main
- Phase 06 Plan 02: Non-blocking GitHub Actions trigger (job stays queued on failure)
- Phase 06 Plan 02: Environment validation at trigger time (not startup)
- Phase 06 Plan 03: workflow_dispatch over repository_dispatch for typed inputs and better UI
- Phase 06 Plan 03: 15-minute workflow timeout (matches job timeout threshold)
- Phase 06 Plan 03: Separate success/failure callback steps with if: success() and if: failure()
- Phase 06 Plan 03: Placeholder provisioning step for Phase 7-8 implementation
- Phase 07 Plan 01: Use native fetch instead of external HTTP libraries (matches existing codebase)
- Phase 07 Plan 01: Use location property instead of deprecated datacenter (Hetzner deprecating after July 2026)
- Phase 07 Plan 01: Include NTP sync in cloud-init before Tailscale installation (prevents SSL errors from clock skew)
- Phase 07 Plan 01: OAuth-based ephemeral auth keys instead of static API keys (security best practice)
- Phase 07 Plan 03: Update agent status to 'active' atomically with instance creation in completeProvisioningWithMetadata
- Phase 07 Plan 03: Support backward compatibility for status=running without metadata via conditional routing

### Pending Todos

None yet.

### Blockers/Concerns

**Architecture:**
- Vercel serverless timeout (10s hobby, 60s pro) incompatible with 5-15min infrastructure operations — mitigation: async-first pattern established in Phase 6
- Hetzner API rate limits (100-200 req/min) require monitoring and backoff — address during Phase 7 implementation
- openclaw-ansible localhost dependencies unknown until examined — address during Phase 8 planning

**Scope:**
- Scope narrowed from research suggestions: no multi-region, no health monitoring, no failure notifications in v1.1
- Focus on core provisioning pipeline only

**Existing Code:**
- Codebase mapped: `.planning/codebase/` (2026-02-13)
- Simulated provisioning exists at `src/lib/provisioning/simulator.ts` — to be replaced
- Stripe webhook handler exists at `src/app/api/webhooks/stripe/route.ts` — to be enhanced
- Agent provisioning API exists at `src/app/api/agents/[id]/provision/route.ts` — to be refactored
- Existing provisioning status UI at `src/components/dashboard/provisioning-status.tsx` — to be wired with real data

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed Phase 07 Plan 03 — VM metadata storage and agent activation
Resume file: .planning/phases/07-vm-provisioning-via-hetzner-api/07-03-SUMMARY.md
