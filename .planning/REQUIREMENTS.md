# Requirements: Aura

**Defined:** 2026-02-13
**Core Value:** Users can deploy a fully configured, always-on AI agent without touching infrastructure

## v1.1 Requirements

Requirements for milestone v1.1 — Infrastructure: Automated Agent Provisioning. Each maps to roadmap phases.

### Provisioning Pipeline

- [ ] **PROV-01**: System creates Hetzner VM via direct API when user completes payment
- [ ] **PROV-02**: System configures VM via openclaw-ansible adapted for remote execution
- [ ] **PROV-03**: System enrolls VM in Tailscale network with ephemeral auth keys
- [ ] **PROV-04**: System dispatches provisioning jobs via async queue (PostgreSQL job queue + GitHub Actions)
- [ ] **PROV-05**: System handles webhook callbacks to update provisioning status in database
- [ ] **PROV-06**: User's agent is running within 5 minutes of payment

### Lifecycle Management

- [ ] **LIFE-01**: User can stop a running agent (Hetzner server shutdown, preserve data)
- [ ] **LIFE-02**: User can restart a stopped agent (Hetzner server start)
- [ ] **LIFE-03**: System destroys VM and cleans up resources when subscription is cancelled
- [ ] **LIFE-04**: System automatically rolls back partial provisioning on failure (delete orphaned VMs)
- [ ] **LIFE-05**: System suspends agent on payment failure without destroying data

### Status Reporting

- [ ] **STAT-01**: User sees real-time provisioning progress in dashboard (Queued → Provisioning → Configuring → Networking → Running)
- [ ] **STAT-02**: System updates existing provisioning UI with real data from pipeline callbacks

### Async Orchestration

- [ ] **ORCH-01**: Stripe webhook triggers idempotent provisioning job (no duplicate VMs on retry)
- [ ] **ORCH-02**: GitHub Actions workflow executes VM creation, Ansible, and Tailscale enrollment
- [ ] **ORCH-03**: Workflow posts status callbacks to API endpoint for database updates

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Monitoring & Alerting

- **MON-01**: System performs health checks on running agents (heartbeat, systemd status)
- **MON-02**: System sends email notifications when agent provisioning fails
- **MON-03**: System sends alerts when running agent goes down
- **MON-04**: Dashboard shows instance metadata (server IP, region, resource usage)

### Multi-Region

- **REG-01**: User can select deployment region (US-East or EU-Central) during agent creation
- **REG-02**: Terraform module parameterized per region

### Advanced Lifecycle

- **ADV-01**: Zero-downtime agent updates via blue-green deployment
- **ADV-02**: Automatic VM scaling (CPX11 → CPX21) based on usage metrics
- **ADV-03**: One-click SSH access via Tailscale SSH + web terminal
- **ADV-04**: Infrastructure cost transparency in dashboard

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Kubernetes orchestration | Overkill for 50-200 agents, openclaw-ansible requires full OS |
| Multi-cloud (AWS/GCP) | Hetzner sufficient for current scale, 60-80% cheaper |
| Custom Ansible playbooks | Security risk (arbitrary root code), breaks support model |
| Real-time log streaming | Massive infra cost at scale, offer last 1000 lines via API instead |
| Manual server selection | Over-optimization for 1% of users, offer 2-3 tiers instead |
| Live migration between regions | Complex state transfer, graceful shutdown + reprovision sufficient |
| Terraform IaC | Direct Hetzner API simpler for create/destroy single VMs, DB is source of truth |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROV-01 | Phase 7 | Pending |
| PROV-02 | Phase 8 | Pending |
| PROV-03 | Phase 7 | Pending |
| PROV-04 | Phase 6 | Pending |
| PROV-05 | Phase 6 | Pending |
| PROV-06 | Phase 7 | Pending |
| LIFE-01 | Phase 9 | Pending |
| LIFE-02 | Phase 9 | Pending |
| LIFE-03 | Phase 9 | Pending |
| LIFE-04 | Phase 9 | Pending |
| LIFE-05 | Phase 9 | Pending |
| STAT-01 | Phase 10 | Pending |
| STAT-02 | Phase 10 | Pending |
| ORCH-01 | Phase 6 | Pending |
| ORCH-02 | Phase 6 | Pending |
| ORCH-03 | Phase 6 | Pending |

**Coverage:**
- v1.1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

**Phase Breakdown:**
- Phase 6 (Async Pipeline Foundation): 5 requirements (ORCH-01, ORCH-02, ORCH-03, PROV-04, PROV-05)
- Phase 7 (VM Provisioning): 3 requirements (PROV-01, PROV-03, PROV-06)
- Phase 8 (Agent Configuration): 1 requirement (PROV-02)
- Phase 9 (Lifecycle Management): 5 requirements (LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05)
- Phase 10 (Status Integration): 2 requirements (STAT-01, STAT-02)

---
*Requirements defined: 2026-02-13*
*Last updated: 2026-02-13 after roadmap creation*
