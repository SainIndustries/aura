# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Users can deploy a fully configured, always-on AI agent without touching infrastructure
**Current focus:** Phase 8 complete — ready for Phase 9

## Current Position

Phase: 8 of 10 (Agent Configuration via Ansible)
Plan: 1 of 1 complete
Status: Phase 8 complete, ready for Phase 9
Last activity: 2026-02-13 — Completed 08-01: Ansible playbook and GitHub Actions workflow integration

Progress: [██████░░░░] 60% (v1.1 phases - 3 of 5 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 2.2 minutes
- Total execution time: 0.24 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 06    | 3     | 445s  | 148s     |
| 07    | 3     | 355s  | 118s     |
| 08    | 1     | 147s  | 147s     |

**Recent Trend:**
- Last 5 plans: 06-03 (152s), 07-01 (124s), 07-03 (116s), 07-02 (115s), 08-01 (147s)
- Trend: Consistent execution speed around 2 minutes per plan

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
- Phase 07 Plan 02: Use relative imports (../hetzner, ../tailscale, ../cloud-init) in provision-vm.ts for reliable standalone execution in GitHub Actions
- Phase 07 Plan 02: Region-to-location mapping with nbg1 as default when region not in predefined map
- Phase 07 Plan 02: Server naming pattern: agent-{agentId first 8 chars}-{timestamp} for uniqueness and traceability
- Phase 07 Plan 02: Use jq for JSON construction in workflow callbacks to avoid escaping issues
- Phase 07 Plan 02: Node.js 20 with npm ci ensures TypeScript execution works in Actions environment
- Phase 07 Plan 03: Update agent status to 'active' atomically with instance creation in completeProvisioningWithMetadata
- Phase 07 Plan 03: Support backward compatibility for status=running without metadata via conditional routing
- Phase 08 Plan 01: Use apt for Ansible installation in GitHub Actions instead of pipx (faster, sufficient for CI)
- Phase 08 Plan 01: Use tailscale/github-action@v3 to join runner to Tailnet for SSH access to VMs
- Phase 08 Plan 01: Generate dynamic Ansible inventory in workflow from VM provisioning outputs
- Phase 08 Plan 01: Accept new SSH host keys with StrictHostKeyChecking=accept-new (fresh VMs)
- Phase 08 Plan 01: Set agent service to enabled but allow start to fail (agent binary deployed in later phase)
- Phase 08 Plan 01: Single platform SSH key from GitHub Secrets for all VMs (per-agent keys deferred to Phase 11)

### Pending Todos

**Deferred verification (test before production):**
- [ ] Add `HETZNER_SSH_PRIVATE_KEY` GitHub secret (private key matching HETZNER_SSH_KEY_ID from Phase 7)
- [ ] Verify `TAILSCALE_OAUTH_CLIENT_ID` and `TAILSCALE_OAUTH_CLIENT_SECRET` GitHub secrets exist (from Phase 7)
- [ ] Verify Tailscale ACL allows `tag:ci` tag (used by GitHub Actions runner)
- [ ] Run full E2E workflow: Stripe payment → VM creation → Ansible config → running agent
- [ ] Verify cloud-init timing + SSH readiness on fresh Hetzner VMs
- [ ] Verify agent systemd service persistence after VM reboot

### Blockers/Concerns

**Architecture:**
- Vercel serverless timeout (10s hobby, 60s pro) incompatible with 5-15min infrastructure operations — mitigation: async-first pattern established in Phase 6
- Hetzner API rate limits (100-200 req/min) require monitoring and backoff — addressed during Phase 7 implementation
- openclaw-ansible localhost dependencies resolved — adapted for remote execution in Phase 8

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
Stopped at: Completed Phase 08 Plan 01 — Ansible playbook and GitHub Actions workflow integration
Resume file: .planning/phases/08-agent-configuration-via-ansible/08-01-SUMMARY.md
