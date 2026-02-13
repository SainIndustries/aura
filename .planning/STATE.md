# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Users can deploy a fully configured, always-on AI agent without touching infrastructure
**Current focus:** Phase 6 - Async Pipeline Foundation

## Current Position

Phase: 6 of 10 (Async Pipeline Foundation)
Plan: 1 of 3 completed
Status: In progress
Last activity: 2026-02-13 — Completed plan 06-01: Database schema and job queue operations

Progress: [█░░░░░░░░░] 10% (v1.1 phases - 1 of 10 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: 3.2 minutes
- Total execution time: 0.05 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 06    | 1     | 193s  | 193s     |

**Recent Trend:**
- Last 5 plans: 06-01 (193s)
- Trend: Establishing baseline

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
Stopped at: Completed Phase 06 Plan 01 - Database schema and job queue operations
Resume file: .planning/phases/06-async-pipeline-foundation/06-01-SUMMARY.md
