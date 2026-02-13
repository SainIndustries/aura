# Project Research Summary

**Project:** Aura - AI Agent SaaS Platform with Automated Infrastructure Provisioning
**Domain:** Infrastructure-as-a-Service orchestration for AI agent hosting
**Researched:** 2026-02-13
**Confidence:** MEDIUM-HIGH

## Executive Summary

Aura is an AI agent hosting platform that requires automated provisioning of dedicated Hetzner VMs per customer subscription. Research reveals this is fundamentally an infrastructure orchestration problem, not a traditional SaaS feature addition. The critical architectural constraint is Vercel's serverless timeout limit (10s hobby, 60s pro), which is incompatible with infrastructure operations that take 5-15 minutes (Terraform + Ansible combined). The recommended approach is an asynchronous webhook-triggered GitHub Actions pattern: Stripe webhooks queue provisioning jobs, GitHub Actions workflows execute long-running Terraform and Ansible operations, and status updates flow back to the application database via webhook callbacks.

The primary technical risk is operational complexity from managing stateful infrastructure (VMs, Terraform state, network configuration) within a stateless serverless application. This creates numerous pitfall scenarios including state file corruption, orphaned resources costing real money, and webhook retry-induced duplicate provisioning. The mitigation strategy is to establish bulletproof foundations in Phase 1 (remote state with locking, idempotent webhooks, per-instance workspace isolation, connection pooling) before writing any Terraform or Ansible code. Shortcuts in foundation setup cannot be easily retrofitted later and directly impact the ability to safely destroy billable resources.

The architecture must be async-first from day one. Any synchronous provisioning attempt will fail in production. The existing simulator correctly demonstrates the desired UX (instant webhook response, status polling, real-time updates) but must be replaced with a production-grade asynchronous orchestration system that treats GitHub Actions as the execution environment for infrastructure operations.

## Key Findings

### Recommended Stack

Aura should adopt a **GitHub Actions-centric infrastructure orchestration** pattern using Vercel for application hosting, GitHub Actions for long-running operations, and direct REST API calls for external services. No mature TypeScript SDKs exist for Hetzner or Tailscale, requiring direct API integration.

**Core technologies:**
- **Octokit (^5.0.5)** for triggering GitHub Actions workflows — Official GitHub SDK; enables webhook-to-workflow orchestration pattern
- **Hetzner Cloud REST API (v2)** for VM provisioning — No official TypeScript SDK; direct REST via fetch/axios more reliable than unmaintained community packages
- **Tailscale REST API (v2)** with OAuth clients for VPN management — No official Node.js SDK; OAuth clients generate ephemeral auth keys (avoid 90-day key expiration pitfall)
- **Terraform (1.10+)** with Hetzner Provider (v1.59.0+) for IaC — Run from GitHub Actions only, never from Next.js routes; use per-instance workspaces with S3/R2 remote state
- **Ansible (2.16+)** via GitHub Actions for VM configuration — Execute openclaw-ansible playbook remotely; requires localhost-to-remote adaptation
- **PostgreSQL job queue (Drizzle ORM)** for MVP — Leverage existing Neon + Drizzle setup; `FOR UPDATE SKIP LOCKED` pattern sufficient for initial scale; migrate to QStash/Inngest if job volume exceeds 1000/day

**Critical version notes:**
- Hetzner Provider v1.59.0+ required — `datacenter` attribute deprecated after July 1, 2026; use `location` instead
- GitHub Actions pricing changed March 1, 2026 — New $0.002/min cloud platform fee for private repos; self-hosted runners 7.3x cheaper for high CI/CD usage
- Drizzle ORM 0.45.1 (existing) supports `FOR UPDATE SKIP LOCKED` for concurrent job processing

### Expected Features

Research shows infrastructure automation platforms in 2026 exhibit specific user-facing behaviors: instant feedback (sub-2s webhook response), granular progress visibility (step-by-step status), failure transparency (show actual error, not "something went wrong"), retry without re-payment, and automatic resource cleanup on cancellation.

**Must have (table stakes):**
- **Automatic provisioning from payment** — Stripe webhook triggers deploy without manual steps; user expects immediate "Provisioning..." status
- **Real-time provisioning status** — Existing `ProvisioningStatus` component ready; needs real data feed (5 steps: queued → provisioning VM → configuring → joining network → running)
- **Error recovery and retry logic** — Network/API failures inevitable at scale; requires idempotent operations, exponential backoff, transient vs permanent failure classification
- **Agent start/stop controls** — Users expect ability to pause/resume; Hetzner API supports VM stop/start (preserve state, cheaper than destroy/recreate)
- **Resource cleanup on cancellation** — Subscription ends → auto-terminate VM within 24h; prevents orphaned resources costing $5-8/month per instance
- **Provisioning failure notifications** — Email via Resend on "failed" status; reduces support burden
- **Instance metadata display** — Show server IP, region, resource specs; builds trust

**Should have (competitive advantage):**
- **Sub-5-minute provisioning** — Target competitive with full-VM platforms (Render: 3-7min); requires parallel Terraform + Ansible, optimized playbook
- **Automatic rollback on failure** — Partial provision states (VM created but Tailscale failed) must auto-cleanup to prevent orphans
- **Multi-region selection** — User chooses `us-east` or `eu-central`; Tailscale works globally; separate Terraform workspaces per region
- **Infrastructure cost transparency** — Show exact Hetzner cost per agent ($5/mo for CPX11, $8.50/mo for CPX21)

**Defer (v2+):**
- **Zero-downtime agent updates** — Blue-green deployment at VM level; complex, defer to v1.2+
- **One-click SSH access** — Browser terminal via Tailscale SSH + xterm.js; requires Tailscale auth integration
- **Automatic VM scaling** — Monitor usage, auto-upgrade CPX11 → CPX21; requires metrics pipeline

**Anti-features (avoid):**
- **Manual server selection** — Over-optimization for 1% of users; offer 2-3 preset tiers instead
- **Real-time log streaming in dashboard** — Massive infra cost (WebSockets × 200 agents); offer last 1000 lines via API instead
- **Custom Ansible playbooks** — Security nightmare (arbitrary root execution); keep openclaw-ansible locked, expose config via env vars

### Architecture Approach

The standard architecture for serverless infrastructure orchestration uses a **three-layer async pattern**: presentation layer (Vercel) accepts requests and returns immediately, orchestration layer (GitHub Actions) executes long-running operations, and data layer (PostgreSQL) acts as source of truth for state transitions. The critical pattern is webhook-triggered CI/CD: Stripe webhook → queue job → trigger GitHub Actions workflow → workflow posts status callbacks → database updates → frontend polls status.

**Major components:**
1. **Next.js API Routes (Vercel)** — Accept provisioning requests, trigger workflows, track status; 10s timeout limit means NEVER run Terraform/Ansible directly
2. **GitHub Actions Workflows** — Execute Terraform (2-5min), Ansible (3-10min), Tailscale enrollment (10-30s); post status callbacks to application webhook endpoint
3. **Terraform with per-instance workspaces** — Each agent gets isolated state file `agents/{instanceId}/terraform.tfstate` in S3/R2; enables parallel provisioning, independent destruction, prevents state conflicts
4. **Database-driven state machine** — PostgreSQL `agent_instances` table stores desired state; workflows reconcile infrastructure to match; statuses: pending → provisioning → running → stopping → stopped → failed
5. **Ansible dynamic inventory** — Query PostgreSQL for active instances at runtime; no static inventory files that drift from reality

**Key patterns:**
- **Callback-based status updates:** Workflows POST to `/api/provisioning/webhook` after each step (terraform_init, vm_created, ansible_configure, network_joined, running)
- **Per-instance Terraform workspace:** Workspace name = `agent-{instanceId}`; separate state files prevent concurrent modification conflicts
- **Idempotent webhook handling:** Store processed `event.id` before provisioning; return 200 for duplicates without re-provisioning
- **OAuth-based Tailscale enrollment:** Generate ephemeral auth keys per-provision via API; avoids 90-day expiration pitfall of hardcoded keys

### Critical Pitfalls

Research identified 11 major pitfalls specific to infrastructure automation in serverless environments. Top 5 by severity and likelihood:

1. **Vercel Serverless Timeout During VM Provisioning** — Stripe webhook waits for 5-15min pipeline, hits timeout, triggers retries, creates duplicate VMs costing real money. SOLUTION: Return 200 immediately, queue job, never wait for Terraform/Ansible in webhook handler. ADDRESS: Phase 1 (architecture must be async-first from beginning).

2. **Terraform State File Corruption from Concurrent Modifications** — Two users subscribe simultaneously, parallel Terraform applies corrupt shared state, orphan VMs. SOLUTION: Remote state backend with locking + per-instance workspaces BEFORE first apply. ADDRESS: Phase 1 (cannot be retrofitted safely).

3. **Secrets Exposed in Terraform State Files** — State contains plaintext API tokens, passwords, SSH keys; S3 without encryption or committed to git leaks entire infrastructure. SOLUTION: S3 encryption, Terraform Cloud, `.gitignore` for state, Vault for secrets, immediate rotation if exposed. ADDRESS: Phase 1 (security foundation).

4. **Ansible Localhost-to-Remote Migration Breaks openclaw-ansible** — Playbook runs on localhost but fails remotely; SSH refused, Python deps missing, `ansible_connection: local` hardcoded. SOLUTION: Change `hosts: localhost` → `hosts: all`, remove local connection, wait for cloud-init `/var/lib/cloud/instance/boot-finished`, test against real VM. ADDRESS: Phase 2 (core technical work).

5. **Webhook Idempotency Missing Causes Duplicate VM Provisioning** — Network glitch causes timeout, Stripe retries same event, creates second VM for same user, double charges. SOLUTION: Store processed `event.id` in database BEFORE provisioning, return 200 for duplicates, use transactions. ADDRESS: Phase 1 (critical for production reliability).

**Additional critical pitfalls:**
- **Hetzner API Rate Limits** (429 errors at 100-200 req/min) — Set `max_retries = 10`, use `-parallelism=1`, exponential backoff. ADDRESS: Phase 3.
- **Tailscale Auth Key Expiration** (90-day key breaks future provisions) — Use OAuth clients to generate ephemeral keys per-provision. ADDRESS: Phase 2.
- **Orphaned VMs from Failed Destroys** (state missing, dependencies block deletion) — Dual-deletion (Terraform + direct API), daily reconciliation job, tag VMs with customer ID. ADDRESS: Phase 3.
- **Database Connection Exhaustion** (100 connections exceeded in webhook burst) — PgBouncer pooler, `max: 1` per function, transaction mode. ADDRESS: Phase 1.
- **Cloud-Init Race Condition** (Ansible connects before user exists) — Wait for `/var/lib/cloud/instance/boot-finished`, retry with delays. ADDRESS: Phase 2.

## Implications for Roadmap

Based on research, suggested phase structure emphasizes **foundation-first approach** where architectural patterns, state management, and security are established before writing any infrastructure code. The research strongly indicates that shortcuts in Phase 1 (local state, synchronous webhooks, no idempotency) cannot be easily fixed later and directly impact production reliability.

### Phase 1: Foundation & Async Orchestration
**Rationale:** All critical pitfalls requiring architectural decisions must be resolved before infrastructure code is written. Terraform state corruption, webhook idempotency, connection pooling, and serverless timeout handling are foundational patterns that cannot be retrofitted.

**Delivers:**
- Remote Terraform state backend (S3/R2) with DynamoDB locking configured
- Per-instance workspace isolation pattern established
- GitHub Actions workflow scaffolding (repository_dispatch trigger, callback pattern)
- Webhook idempotency handler (tracks `event.id`, returns 200 for duplicates)
- Database connection pooling (PgBouncer or Neon pooler, `max: 1`)
- API route wiring: `/api/agents/[id]/provision` → `triggerProvisioningWorkflow()`
- Callback endpoint: `/api/provisioning/webhook` receives status updates from workflows
- Cost control: per-customer VM count limit (1 active VM per subscription)

**Addresses features:**
- Automatic provisioning from payment (async architecture)
- Resource cleanup on cancellation (destruction workflow)
- Instance metadata display (database schema)

**Avoids pitfalls:**
- Pitfall 1: Serverless timeout (async-first architecture)
- Pitfall 2: State corruption (remote state + locking)
- Pitfall 3: Secrets in state (S3 encryption, proper secret handling)
- Pitfall 5: Duplicate provisioning (idempotency)
- Pitfall 9: Connection exhaustion (pooling + `max: 1`)

**Estimated duration:** 5-7 days

---

### Phase 2: Terraform VM Provisioning
**Rationale:** With foundation established, build Terraform module for VM provisioning. Must test workspace isolation, state locking, and destruction before adding Ansible complexity.

**Delivers:**
- Terraform module: `infrastructure/terraform/modules/hetzner-agent-vm/`
- VM provisioning (Hetzner Cloud API via Terraform provider)
- SSH key distribution (public key in Terraform, private key in GitHub Secrets)
- Basic networking (firewall rules, allow Tailscale network + SSH)
- GitHub Actions workflow: `provision-agent.yml` runs Terraform apply
- Termination workflow: `terminate-agent.yml` runs Terraform destroy
- Terraform outputs captured: `server_id`, `server_ip`, `region`
- Status callbacks to `/api/provisioning/webhook` after Terraform steps
- Test: Create VM, verify in Hetzner console, destroy, verify cleanup

**Addresses features:**
- Real-time provisioning status (Terraform step callbacks)
- Agent start/stop controls (create/destroy workflows)

**Avoids pitfalls:**
- Pitfall 2: State corruption (validates workspace isolation works)
- Pitfall 8: Orphaned VMs (tests destroy workflow)

**Uses stack elements:**
- Terraform 1.10+, Hetzner Provider v1.59.0+
- Octokit for triggering workflows
- S3/R2 for state storage

**Estimated duration:** 5-7 days

---

### Phase 3: Ansible Adaptation (Localhost → Remote)
**Rationale:** openclaw-ansible playbook must be adapted for remote execution. This is pure technical work with no dependencies on other phases. Must be thoroughly tested against real VMs before integration.

**Delivers:**
- Forked openclaw-ansible playbook adapted for remote execution
- Changed `hosts: localhost` → `hosts: all`
- Removed `ansible_connection: local`
- Added cloud-init wait: `/var/lib/cloud/instance/boot-finished`
- SSH known_hosts handling (ssh-keyscan pre-task or disable checking for specific inventory)
- Python dependencies installed remotely
- Dynamic inventory script: queries PostgreSQL for VMs with `status='provisioning'`
- Test playbook locally against development Hetzner VM
- 100% success rate on fresh VM provisions

**Addresses features:**
- (Enables) Agent runtime installation and configuration

**Avoids pitfalls:**
- Pitfall 4: Localhost-to-remote migration (core fix)
- Pitfall 7: Cloud-init race condition (explicit wait)
- Pitfall 9: SSH known_hosts issues (automated handling)

**Uses stack elements:**
- Ansible 2.16+
- Dynamic inventory pattern

**Estimated duration:** 4-6 days

---

### Phase 4: Ansible Integration with Workflow
**Rationale:** With working Terraform module (Phase 2) and adapted Ansible playbook (Phase 3), integrate Ansible into GitHub Actions workflow. Phases 2 and 3 must be complete before this phase.

**Delivers:**
- Extended `provision-agent.yml`: Add Ansible step after Terraform
- Ansible executes against VM IP from Terraform outputs
- SSH connection retry logic with exponential backoff
- Ansible playbook execution: `setup-agent.yml`
- Agent runtime installed: Docker, systemd service, openclaw agent
- Status callback after Ansible completes: `status='provisioning'`, `step='ansible_complete'`
- Test: End-to-end provision creates VM, configures agent, agent starts
- Error handling: Ansible failure triggers cleanup (destroy VM to prevent orphan)

**Addresses features:**
- (Completes) Automatic provisioning from payment
- Basic health monitoring (agent systemd status check)

**Avoids pitfalls:**
- Pitfall 8: Orphaned VMs (cleanup on Ansible failure)

**Implements architecture:**
- Callback-based status updates
- Error recovery pattern

**Estimated duration:** 3-5 days

---

### Phase 5: Tailscale Network Enrollment
**Rationale:** VPN layer adds network configuration on top of working VM + Ansible pipeline. Requires OAuth client setup to avoid auth key expiration pitfall.

**Delivers:**
- Tailscale OAuth client configured (client ID/secret in GitHub Secrets)
- Tailscale API client: `src/lib/provisioning/tailscale.ts`
- Generate ephemeral auth key per-provision via API: `POST /api/v2/tailnet/:tailnet/keys`
- Ansible task: Install Tailscale, join network with ephemeral key
- Capture Tailscale IP from device API: `GET /api/v2/device/:deviceId`
- Store `tailscaleIp` in database
- Status callback: `status='running'`, includes `tailscaleIp`
- Test: Provision VM, verify device in Tailscale admin, ping Tailscale IP
- Termination workflow: Remove device via Tailscale API before destroying VM

**Addresses features:**
- (Enables) Multi-agent coordination via private network
- Instance metadata display (Tailscale IP shown in dashboard)

**Avoids pitfalls:**
- Pitfall 6: Auth key expiration (OAuth client generates ephemeral keys)

**Uses stack elements:**
- Tailscale REST API v2
- OAuth client pattern

**Estimated duration:** 3-4 days

---

### Phase 6: Error Recovery & Monitoring
**Rationale:** With core provisioning working (Phases 2-5), add production-grade error handling, retry logic, and monitoring before load testing.

**Delivers:**
- Hetzner API rate limit monitoring (check response headers)
- Exponential backoff for Hetzner API retries (2s → 4s → 8s → 16s → fail)
- Automatic rollback: Partial provision states trigger cleanup
- Failed provision recovery: Mark as 'failed', allow user retry without re-payment
- Daily reconciliation job: Compare Hetzner VMs to database records, alert on orphans
- Provisioning failure notifications: Email user via Resend on 'failed' status
- Cost monitoring: Track expected cost per customer, alert on anomalies
- Status page: Show average provision time, failure rate by region

**Addresses features:**
- Error recovery and retry logic (complete)
- Provisioning failure notifications (complete)
- Automatic rollback on failure (differentiator)

**Avoids pitfalls:**
- Pitfall 5: API rate limits (monitoring + backoff)
- Pitfall 8: Orphaned VMs (reconciliation job)
- Pitfall 10: Cost spiral (per-customer tracking, alerts)

**Estimated duration:** 4-6 days

---

### Phase 7: Polish & Production Readiness
**Rationale:** Final phase improves UX and ensures production reliability before launch.

**Delivers:**
- Enhanced status UI: Granular progress (5 steps with ETA)
- Retry button: User can retry failed provision without new charge
- Multi-region support: User selects `us-east` or `eu-central` during agent creation
- Infrastructure cost display: Show "Your agent costs $5.12/month" in dashboard
- Agent health check: Heartbeat every 60s, dashboard shows "healthy" or "unhealthy"
- Load testing: Provision 10-20 agents concurrently, verify no failures
- Documentation: Runbook for manual VM cleanup, state recovery procedures
- Remove simulator: Delete `src/lib/provisioning/simulator.ts` and references

**Addresses features:**
- Real-time provisioning status (enhanced UI)
- Basic health monitoring (heartbeat)
- Multi-region selection (competitive feature)
- Infrastructure cost transparency (builds trust)

**Estimated duration:** 4-5 days

---

### Phase Ordering Rationale

- **Foundation-first approach:** Phase 1 establishes non-negotiable architectural patterns. Research shows all 5 critical pitfalls requiring architectural decisions MUST be addressed before infrastructure code is written. Terraform state corruption, webhook idempotency, and connection pooling cannot be retrofitted safely.

- **Terraform before Ansible:** Phase 2 must precede Phase 3 because Ansible needs VMs to exist. Separating Terraform and Ansible into distinct phases allows independent testing and reduces complexity of first integration.

- **Ansible adaptation in isolation:** Phase 3 can be developed in parallel with Phase 2 (both depend only on Phase 1). Adapting openclaw-ansible from localhost to remote execution is pure technical work that should be thoroughly tested against development VMs before production integration.

- **Integration after both working:** Phase 4 combines Terraform (Phase 2) and Ansible (Phase 3) only after both are proven to work independently. This reduces debugging complexity.

- **Networking as enhancement layer:** Phase 5 adds Tailscale on top of working VM + configuration pipeline. Network failures are easier to debug and retry when VM and agent are already running.

- **Error handling before scale:** Phase 6 must complete before load testing or production launch. Research shows API rate limits, orphaned resources, and connection exhaustion manifest under load; proactive monitoring prevents production incidents.

- **UX polish last:** Phase 7 enhances user experience after core reliability is proven. Multi-region, health checks, and enhanced status UI are valuable but not blocking for MVP functionality.

### Phase Dependencies

```
Phase 1 (Foundation)
    ├──> Phase 2 (Terraform) ──┐
    └──> Phase 3 (Ansible)     ├──> Phase 4 (Integration)
                                └──> Phase 5 (Tailscale)
                                        └──> Phase 6 (Error Recovery)
                                                └──> Phase 7 (Polish)
```

Phases 2 and 3 can run in parallel. All other phases are sequential.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 2 (Terraform):** Hetzner Provider v1.59.0 deprecations (`datacenter` → `location`); S3/R2 backend configuration with DynamoDB locking alternatives
- **Phase 3 (Ansible):** openclaw-ansible playbook internals; specific localhost dependencies; Python package requirements
- **Phase 5 (Tailscale):** OAuth client setup workflow; ephemeral key generation API; device management API

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Webhook idempotency is well-documented pattern; Octokit for workflow triggers is standard
- **Phase 4 (Integration):** Combining Terraform + Ansible in GitHub Actions is well-documented
- **Phase 6 (Error Recovery):** Exponential backoff, reconciliation jobs, monitoring are standard SRE patterns
- **Phase 7 (Polish):** UI enhancements, health checks, cost display are standard SaaS features

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **MEDIUM** | HIGH on job queue patterns, Octokit, Terraform/Ansible; MEDIUM on Hetzner/Tailscale due to lack of official TypeScript SDKs requiring manual API integration |
| Features | **MEDIUM-HIGH** | HIGH on table stakes features (status updates, cleanup, error handling) based on competitor analysis; MEDIUM on provisioning speed estimates (target <5min depends on Hetzner API performance and openclaw-ansible optimization) |
| Architecture | **HIGH** | Webhook-triggered CI/CD orchestration is well-established pattern for serverless + IaC; per-instance workspace pattern is documented; callback-based status updates proven in production systems |
| Pitfalls | **HIGH** | All 11 pitfalls backed by official documentation or production post-mortems; state corruption, webhook retries, cloud-init races extensively documented; phase-to-pitfall mapping validated against standard practices |

**Overall confidence:** **MEDIUM-HIGH**

Confidence HIGH on architectural approach, async patterns, and pitfall avoidance strategies. Confidence MEDIUM on integration specifics (Hetzner API behavior under load, openclaw-ansible adaptation complexity, Tailscale OAuth workflow). These areas require validation during implementation but don't affect overall architectural soundness.

### Gaps to Address

- **Hetzner API rate limits:** Documentation mentions 100-200 req/min but exact limits per endpoint unclear; community reports vary. MITIGATION: Implement rate limit header monitoring from day 1; contact Hetzner support for production usage clarification; exponential backoff handles transient limits.

- **openclaw-ansible localhost dependencies:** Without examining actual playbook, exact adaptation effort unknown. Research assumes standard playbook patterns (apt/pip packages, systemd services, Docker setup). MITIGATION: Phase 3 includes thorough testing against development VM; allocate buffer time for unexpected dependencies.

- **Tailscale device lifecycle:** API documentation covers device creation but cleanup workflow (remove device, reclaim IP) less documented. MITIGATION: Test complete provision → destroy → reprovision cycle during Phase 5; document manual cleanup procedures.

- **Vercel `waitUntil()` applicability:** Recent Vercel feature for background work in serverless functions; unclear if sufficient for job queueing or if external queue (QStash) needed. MITIGATION: Phase 1 starts with PostgreSQL job queue (known pattern); evaluate `waitUntil()` as potential simplification during implementation.

- **Drizzle ORM performance at scale:** `FOR UPDATE SKIP LOCKED` pattern proven for job queues but performance characteristics at 50-200 concurrent jobs unknown. MITIGATION: Phase 6 includes load testing; plan migration path to QStash/Inngest if PostgreSQL queue becomes bottleneck.

## Sources

### Primary Sources (HIGH confidence)

**Stack Research:**
- [Hetzner Cloud API Documentation](https://docs.hetzner.cloud/) — Official REST API reference
- [GitHub: octokit/octokit.js](https://github.com/octokit/octokit.js/) — Official Node.js SDK, v5.0.5 published Feb 2026
- [Tailscale API Documentation](https://tailscale.com/api) — Official REST API reference
- [Terraform Registry: Hetzner Provider](https://registry.terraform.io/providers/hetznercloud/hcloud/latest) — v1.59.0 official provider
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations) — Official timeout limits (10s hobby, 60s pro)
- [Upstash QStash Documentation](https://upstash.com/docs/qstash/overall/compare) — Serverless queue comparison

**Architecture Research:**
- [HashiCorp: Automate Terraform with GitHub Actions](https://developer.hashicorp.com/terraform/tutorials/automation/github-actions) — Official tutorial
- [Spacelift: Terraform with GitHub Actions](https://spacelift.io/blog/github-actions-terraform) — Production patterns
- [Ansible: Working with dynamic inventory](https://docs.ansible.com/projects/ansible/latest/inventory_guide/intro_dynamic_inventory.html) — Official docs
- [Spacelift: Terraform S3 Backend Best Practices](https://spacelift.io/blog/terraform-s3-backend) — State management patterns

**Pitfalls Research:**
- [Spacelift: Managing Terraform State - Best Practices](https://spacelift.io/blog/terraform-state) — State corruption scenarios
- [Stripe: Idempotent Requests](https://docs.stripe.com/api/idempotent_requests) — Official webhook retry behavior
- [Vercel: Connection Pooling with Serverless Functions](https://vercel.com/guides/connection-pooling-with-serverless-functions) — Official guide
- [Medium: Handling Payment Webhooks Reliably](https://medium.com/@sohail_saifii/handling-payment-webhooks-reliably-idempotency-retries-validation-69b762720bf5) — Idempotency patterns
- [Tailscale: OAuth Clients Documentation](https://tailscale.com/kb/1215/oauth-clients) — Official OAuth workflow

### Secondary Sources (MEDIUM confidence)

**Features Research:**
- [Zluri: Top 11 Automated Provisioning Tools in 2026](https://www.zluri.com/blog/automated-provisioning-tools) — Industry trends
- [Microsoft Learn: What is Infrastructure as Code](https://learn.microsoft.com/en-us/devops/deliver/what-is-infrastructure-as-code) — IaC best practices
- [OneReach.ai: Agent Lifecycle Management 2026](https://onereach.ai/blog/agent-lifecycle-management-stages-governance-roi/) — Agent management patterns

**Architecture Research:**
- [AWS Prescriptive Guidance: API-driven resource orchestration](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/create-an-api-driven-resource-orchestration-framework-using-github-actions-and-terragrunt.html) — Orchestration patterns
- [Spacelift: Ansible Dynamic Inventory](https://spacelift.io/blog/ansible-dynamic-inventory) — Types and examples

**Pitfalls Research:**
- [GitHub: terraform-provider-hcloud Issues #601](https://github.com/hetznercloud/terraform-provider-hcloud/issues/601) — Rate limit experiences
- [Medium: Avoiding Terraform State Management Pitfalls](https://medium.com/@mohamed.mourad/avoiding-terraform-state-management-pitfalls-2d6b94bd2ff0) — Common mistakes
- [Medium: Tailscale Auth Key Rotator](https://medium.com/@brent.gruber77/how-i-built-a-tailscale-auth-key-rotator-814722b839e0) — OAuth client pattern

### Tertiary Sources (LOW confidence, needs validation)

- [GitHub: hetznercloud/awesome-hcloud](https://github.com/hetznercloud/awesome-hcloud) — Community libraries (many unmaintained)
- [Altinity: Slash CI/CD Bills with Hetzner](https://altinity.com/blog/slash-ci-cd-bills-part-2-using-hetzner-cloud-github-runners-for-your-repository) — Cost comparison (needs verification)
- Community blog posts on Hetzner automation (various) — Provisioning time estimates vary; needs direct testing

---

*Research completed: 2026-02-13*
*Ready for roadmap: yes*
