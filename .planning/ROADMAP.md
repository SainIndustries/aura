# Roadmap: Aura

## Milestones

- ✅ **v1.0 Foundation** - Phases 1-5 (shipped 2026-02-13)
- 🚧 **v1.1 Infrastructure: Automated Agent Provisioning** - Phases 6-10 (current)

## Phases

<details>
<summary>✅ v1.0 Foundation (Phases 1-5) - SHIPPED 2026-02-13</summary>

**What shipped:**
- Privy authentication (email, Google, GitHub, SMS, passkey)
- Dashboard with agent CRUD and multi-step creation wizard
- 50+ OAuth integrations with encrypted token storage
- Chat interface with OpenAI GPT-4o-mini
- Channel management (7 channel types)
- Stripe billing and subscriptions
- Team management with invites
- Onboarding flow, audit logging, templates, settings
- Marketing pages, rate limiting, error tracking, email

Built organically (pre-GSD). No detailed phase breakdown.

</details>

### 🚧 v1.1 Infrastructure: Automated Agent Provisioning (Current)

**Milestone Goal:** Replace simulated provisioning with real infrastructure. Stripe payment triggers automated Hetzner VM creation, Ansible configuration, and Tailscale enrollment. Target: 50-200 agents.

#### ✅ Phase 6: Async Pipeline Foundation (Complete — 2026-02-13)
**Goal**: Establish async orchestration pattern for long-running infrastructure operations
**Depends on**: Nothing (first phase of v1.1)
**Requirements**: ORCH-01, ORCH-02, ORCH-03, PROV-04, PROV-05
**Success Criteria** (what must be TRUE):
  1. ✓ Stripe webhook receives payment event and returns 200 within 2 seconds without blocking
  2. ✓ Provisioning job appears in database queue with status "queued"
  3. ✓ GitHub Actions workflow triggers automatically when job is queued
  4. ✓ Workflow posts status updates to callback endpoint
  5. ✓ Database reflects workflow status changes in real-time
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md — Database schema (provisioning_jobs table) + job queue operations module
- [x] 06-02-PLAN.md — Stripe webhook enhancement + GitHub Actions workflow trigger
- [x] 06-03-PLAN.md — GitHub Actions callback endpoint + provisioning workflow YAML

#### ✅ Phase 7: VM Provisioning via Hetzner API (Complete — 2026-02-13)
**Goal**: Create and destroy Hetzner VMs with Tailscale networking via direct API calls
**Depends on**: Phase 6
**Requirements**: PROV-01, PROV-03, PROV-06
**Success Criteria** (what must be TRUE):
  1. ✓ GitHub Actions workflow creates Hetzner VM via REST API when job is dispatched
  2. ✓ VM is provisioned with SSH access and basic networking within 2 minutes
  3. ✓ VM automatically joins Tailscale network with ephemeral auth key
  4. ✓ Database stores VM metadata (server_id, server_ip, tailscale_ip, region)
  5. ? Complete provision flow (payment to running VM) completes in under 5 minutes (needs live timing)
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — Hetzner, Tailscale, and cloud-init API client modules
- [x] 07-02-PLAN.md — VM provisioning orchestrator + GitHub Actions workflow integration
- [x] 07-03-PLAN.md — Callback handler extension + database VM metadata storage

#### ✅ Phase 8: Agent Configuration via Ansible (Complete — 2026-02-13)
**Goal**: Configure VMs with openclaw-ansible adapted for remote execution
**Depends on**: Phase 7
**Requirements**: PROV-02
**Success Criteria** (what must be TRUE):
  1. ✓ openclaw-ansible playbook executes against remote VM (not localhost)
  2. ✓ Playbook installs Docker, systemd services, and agent runtime successfully
  3. ✓ Agent process starts automatically and remains running after playbook completes
  4. ? SSH connection handling and cloud-init timing work reliably on fresh VMs (needs live test)
**Plans**: 1 plan

Plans:
- [x] 08-01-PLAN.md — Ansible playbook for remote VM configuration + GitHub Actions workflow integration

#### Phase 9: Lifecycle Management
**Goal**: Users can control agent state and system handles subscription lifecycle
**Depends on**: Phase 8
**Requirements**: LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05
**Success Criteria** (what must be TRUE):
  1. User can stop running agent from dashboard (VM shuts down, data preserved)
  2. User can restart stopped agent from dashboard (VM starts, agent resumes)
  3. System automatically destroys VM and removes Tailscale device when subscription is cancelled
  4. System rolls back partial provisions on failure (deletes orphaned VMs automatically)
  5. System suspends agent on payment failure without destroying data
**Plans**: TBD

Plans:
- [ ] 09-01: TBD during planning

#### Phase 10: Status Integration
**Goal**: Dashboard shows real-time provisioning progress with production data
**Depends on**: Phase 9
**Requirements**: STAT-01, STAT-02
**Success Criteria** (what must be TRUE):
  1. Dashboard displays granular provisioning status (Queued → Provisioning → Configuring → Networking → Running)
  2. Status updates appear in dashboard within 5 seconds of workflow callback
  3. User sees real infrastructure data (not simulated status)
  4. Existing ProvisioningStatus component receives real data from pipeline
**Plans**: TBD

Plans:
- [ ] 10-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7 → 8 → 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5. Foundation | v1.0 | - | Complete | 2026-02-13 |
| 6. Async Pipeline Foundation | v1.1 | 3/3 | Complete | 2026-02-13 |
| 7. VM Provisioning via Hetzner API | v1.1 | 3/3 | Complete | 2026-02-13 |
| 8. Agent Configuration via Ansible | v1.1 | 1/1 | Complete | 2026-02-13 |
| 9. Lifecycle Management | v1.1 | 0/? | Not started | - |
| 10. Status Integration | v1.1 | 0/? | Not started | - |
