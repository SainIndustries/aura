# Feature Research: Automated Agent Provisioning Infrastructure

**Domain:** SaaS Platform Infrastructure Automation
**Researched:** 2026-02-13
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real-time provisioning status | Users need to know what's happening during 5-min deploy window | MEDIUM | Existing UI component ready, needs real data feed via WebSocket or polling API |
| Automatic provisioning from payment | Payment should immediately trigger deployment without manual steps | MEDIUM | Stripe webhook already exists, needs to call real provisioning instead of simulator |
| Error recovery and retry logic | Network/API failures are inevitable at scale (50-200 agents) | HIGH | Requires idempotent operations, exponential backoff (2s, 4s, 8s), classify transient vs permanent failures |
| Agent start/stop controls | Users expect ability to pause/resume to save costs | MEDIUM | Existing stop API route, needs real Hetzner server stop/start, preserve VM state |
| Basic health monitoring | Users need to know if their agent is actually running | MEDIUM | Agent heartbeat pings, service status checks via systemd, Tailscale connectivity |
| Provisioning failure notifications | Silent failures create support burden, users expect alerts | LOW | Email via Resend already integrated, add webhook to send on "failed" status |
| Instance metadata display | Show server IP, region, resource usage to build trust | LOW | Data already tracked in DB schema (serverId, serverIp, tailscaleIp, region) |
| Resource cleanup on cancellation | When subscription ends, VMs must auto-terminate to prevent runaway costs | MEDIUM | Stripe webhook on subscription.deleted → queue termination job → Terraform destroy |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable for positioning.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sub-5-minute provisioning | Most competitors take 10-30 minutes; speed = delight | HIGH | Requires pre-warmed Hetzner API calls, parallel Terraform + Ansible, optimized openclaw-ansible playbook |
| Automatic rollback on failure | Failed deploys auto-clean resources; user can retry immediately | HIGH | Partial provisioning states must track created resources (VM but no Tailscale = delete VM), requires state machine |
| Multi-region selection | User chooses US-East or EU-Central; competitors often single-region | MEDIUM | Hetzner supports multiple datacenters, Terraform module per region, Tailscale works globally |
| Zero-downtime agent updates | Update agent code/config without stopping service | HIGH | Blue-green deployment at VM level or in-place with systemd reload, deferred to v1.2+ |
| Infrastructure cost transparency | Show exact Hetzner cost per agent in dashboard | LOW | CPX11 = $5/mo, CPX21 = $8.50/mo, query Hetzner API for actual billing |
| One-click SSH access | Browser-based SSH terminal to agent VM for debugging | MEDIUM | Tailscale SSH + web terminal (xterm.js), requires Tailscale auth integration |
| Automatic scaling to new VM sizes | Agent usage triggers upgrade from CPX11 → CPX21 | HIGH | Requires usage metrics, VM resize (Hetzner supports), data migration, deferred to v1.3+ |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems or misaligned incentives.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Manual server selection | "Power users" want to pick exact Hetzner server type | Over-optimization for 1% of users, support burden explaining options, pricing complexity | Offer 2-3 tiers (Starter/Pro/Enterprise) with pre-selected hardware, auto-scale |
| Real-time log streaming in dashboard | "I want to see live agent logs" | Massive infra cost (WebSocket connections × 200 agents), Tailscale VPN required, security risk | Offer last 1000 lines via API, downloadable logs, external log service integration (Axiom, Logz.io) |
| Custom Ansible playbooks | "Let me customize the server setup" | Security nightmare (arbitrary root code execution), breaks support, version drift | Offer configuration via env vars, integrations API, keep openclaw-ansible locked |
| Multi-cloud support (AWS/GCP) | "What if Hetzner goes down?" | 3x complexity, 60-80% higher costs, marginal reliability gain at this scale | Document Hetzner SLA (99.9%), maintain infrastructure-as-code for easy migration if needed at 1000+ agents |
| Kubernetes orchestration | "Modern infrastructure should use K8s" | Overkill for 50-200 agents, openclaw-ansible requires full OS/systemd, 10x ops complexity | Per-VM isolation simpler and meets security requirements, revisit at 1000+ agents |
| Live migration between regions | "Move my agent from US to EU instantly" | Complex state transfer, potential data loss, unclear user value | Offer graceful shutdown + reprovision in new region (5 min downtime acceptable) |

## Feature Dependencies

```
Payment Received (Stripe webhook)
    └──requires──> VM Provisioning (Terraform + Hetzner API)
                       └──requires──> Server Configuration (Ansible playbook)
                                          └──requires──> Network Setup (Tailscale enrollment)
                                                             └──enables──> Agent Running (systemd service)

Real-time Status Updates ──requires──> VM Provisioning (must have status to report)

Error Recovery ──enhances──> VM Provisioning (makes it resilient)

Health Monitoring ──requires──> Agent Running (nothing to monitor until running)

SSH Access ──requires──> Tailscale Network (uses Tailscale SSH)

Automatic Cleanup ──requires──> Subscription Tracking (Stripe webhook subscription.deleted)

Multi-region ──conflicts with──> Live Migration (can't migrate if regions are isolated)
```

### Dependency Notes

- **VM Provisioning requires Payment Received:** Stripe webhook `checkout.session.completed` triggers `queueAgentProvisioning()`, which currently calls simulator but needs to call real Terraform/Ansible pipeline
- **Server Configuration requires VM Provisioning:** Can't run Ansible until Hetzner VM exists with known IP address and SSH access
- **Network Setup requires Server Configuration:** Tailscale enrollment happens via Ansible task after base server setup (UFW, Docker, systemd)
- **Real-time Status Updates enhances User Experience:** Existing `ProvisioningStatus` component polls `/api/agents/[id]/instance` every 2s, needs to report real Terraform/Ansible progress
- **Error Recovery enhances VM Provisioning:** Exponential backoff for transient failures (Hetzner API 429, network timeouts), automatic rollback for permanent failures (invalid API key, quota exceeded)
- **SSH Access requires Tailscale:** Tailscale SSH is more secure than exposing port 22, leverages existing VPN mesh, requires user to authenticate via Tailscale identity

## MVP Definition

### Launch With (v1.1 - Current Milestone)

Minimum viable infrastructure — what's needed to replace simulator and provision real agents.

- [x] **Hetzner VM Provisioning via Terraform** — Core infrastructure primitive, replaces fake `generateServerId()`
- [x] **Ansible Deployment (openclaw-ansible)** — Configures server with Docker, systemd, UFW, installs agent runtime
- [x] **Tailscale Network Enrollment** — Secures VMs behind VPN, enables private communication, required for multi-agent coordination
- [x] **Stripe Webhook Integration** — Triggers provisioning on `checkout.session.completed`, already exists but calls simulator
- [x] **Basic Error Handling** — Detect Hetzner API failures, mark instance as "failed", log error message (no retry yet)
- [x] **Status API Updates** — Update `agentInstances` table with real `serverId`, `serverIp`, `tailscaleIp` from Terraform outputs
- [x] **Agent Lifecycle (Start/Stop)** — Hetzner API calls to stop/start VM, preserve state, cheaper than destroy/recreate
- [x] **Resource Cleanup on Termination** — `terraform destroy` when user stops agent, Tailscale device removal via API

### Add After Validation (v1.2)

Features to add once core provisioning is proven stable with 10-20 agents running.

- [ ] **Exponential Retry Logic** — Retry transient Hetzner API failures (429, 5xx) with backoff (2s → 4s → 8s → 16s → fail)
- [ ] **Automatic Rollback on Partial Failure** — If Tailscale enrollment fails, delete Hetzner VM automatically to prevent orphaned resources
- [ ] **Health Check Monitoring** — Agent sends heartbeat every 60s, dashboard shows "healthy" or "unhealthy" status
- [ ] **Provisioning Notifications** — Email user when agent is running or if provisioning fails after retries exhausted
- [ ] **Multi-region Support** — Let user choose `us-east` or `eu-central` during agent creation, separate Terraform workspaces
- [ ] **SSH Access via Tailscale** — One-click SSH button in dashboard, opens browser terminal using Tailscale SSH + xterm.js
- [ ] **Infrastructure Cost Display** — Show "Your agent costs $5.12/month" based on actual Hetzner server type

### Future Consideration (v1.3+)

Features to defer until product-market fit is established and scale demands them.

- [ ] **Zero-downtime Agent Updates** — Blue-green deployment for agent code updates without stopping VM
- [ ] **Automatic VM Scaling** — Monitor CPU/memory, auto-upgrade from CPX11 → CPX21 when agent consistently hits limits
- [ ] **Advanced Log Management** — Integration with Axiom or Logz.io for searchable logs, replaces local file storage
- [ ] **Regional Failover** — If Hetzner `us-east` has outage, auto-reprovision in `us-west` (requires stateless agents)
- [ ] **Custom Resource Limits** — Let Enterprise users request 8GB RAM agents, requires pricing tier logic
- [ ] **Provisioning Analytics** — Track average provision time, failure rate by region, optimize bottlenecks

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Hetzner VM Provisioning | HIGH | HIGH | P1 |
| Ansible Deployment | HIGH | HIGH | P1 |
| Tailscale Enrollment | HIGH | MEDIUM | P1 |
| Stripe Webhook Integration | HIGH | LOW | P1 |
| Basic Error Handling | HIGH | LOW | P1 |
| Status API Updates | HIGH | LOW | P1 |
| Agent Start/Stop | HIGH | MEDIUM | P1 |
| Resource Cleanup | HIGH | MEDIUM | P1 |
| Exponential Retry Logic | MEDIUM | MEDIUM | P2 |
| Automatic Rollback | MEDIUM | HIGH | P2 |
| Health Check Monitoring | MEDIUM | MEDIUM | P2 |
| Provisioning Notifications | MEDIUM | LOW | P2 |
| Multi-region Support | MEDIUM | MEDIUM | P2 |
| SSH Access | MEDIUM | HIGH | P2 |
| Infrastructure Cost Display | LOW | LOW | P2 |
| Zero-downtime Updates | LOW | HIGH | P3 |
| Automatic VM Scaling | LOW | HIGH | P3 |
| Advanced Log Management | LOW | HIGH | P3 |
| Regional Failover | LOW | HIGH | P3 |

**Priority key:**
- **P1 (Must have for launch):** Required to replace simulator and provision real agents; without these, v1.1 milestone incomplete
- **P2 (Should have, add when stable):** Improve reliability and user experience; add after 10-20 agents running successfully
- **P3 (Nice to have, future):** Optimization and scale features; defer until 100+ agents or specific user demand

## Operational Features (Behind-the-Scenes)

These features are not user-facing but essential for SaaS operations.

| Feature | Purpose | Complexity | Notes |
|---------|---------|------------|-------|
| Terraform State Management | Track infrastructure state, prevent drift | MEDIUM | Use Terraform Cloud or S3 backend, lock state to prevent concurrent modifications |
| Idempotent Provisioning | Re-running provision should not duplicate resources | HIGH | Check if VM exists before creating, use Terraform's built-in idempotency |
| Secrets Management | Store Hetzner API key, Tailscale auth key securely | MEDIUM | Use environment variables (Vercel), rotate keys quarterly, never commit to Git |
| Provisioning Queue | Handle multiple concurrent provision requests | MEDIUM | Current implementation fires `simulateProvisioning()` immediately; scale requires job queue (BullMQ + Redis) |
| Infrastructure Audit Logs | Track all Terraform/Ansible executions for debugging | LOW | Log to database or external service (Sentry, Axiom), include request ID for tracing |
| Dead Letter Queue | Failed provisions after all retries go here for manual review | MEDIUM | Separate `failed_provisions` table, alert ops team via email/Slack |
| Terraform Module Versioning | Pin openclaw-ansible version, prevent breaking changes | LOW | Use Git tags or version pins in Terraform module source |
| Graceful Shutdown Handling | User deletes agent mid-provision → cancel and clean up | HIGH | Terraform/Ansible are not easily cancellable; mark as "stopping" and let finish, then destroy |
| Resource Tagging | Tag all Hetzner VMs with `agent_id`, `user_id`, `environment` | LOW | Enables cost tracking, orphan detection, batch operations |
| Monitoring and Alerting | Ops team alerted if provision failure rate >10% | MEDIUM | Aggregate metrics in database, cron job checks hourly, Sentry alert on threshold |

## User-Facing Behaviors Expected in 2026

Based on research, modern SaaS infrastructure platforms exhibit these behaviors:

1. **Instant Feedback**: Payment → "Provisioning started" within 2 seconds (not 30s delay)
2. **Granular Progress**: Show specific steps ("Creating server...", "Installing dependencies...") not generic spinner
3. **Failure Transparency**: If provision fails, show reason ("Hetzner API quota exceeded") not "Something went wrong"
4. **Retry Without Re-paying**: Failed provision lets user click "Retry" without new Stripe checkout
5. **Resource Visibility**: Dashboard shows VM specs, IP address, uptime, costs — builds trust
6. **Automatic Cleanup**: Cancelled subscription terminates VM within 24 hours, user not charged for orphaned resources
7. **Status Persistence**: Refresh page mid-provision, status remains accurate (not reset to "pending")
8. **Graceful Degradation**: If provisioning takes >10 minutes, show "Taking longer than expected, we'll email when ready"

## Competitor Feature Analysis

| Feature | Replit (Deployments) | Railway | Render | Our Approach (Aura) |
|---------|---------------------|---------|--------|---------------------|
| Provisioning Speed | ~30 seconds (container) | ~2-5 minutes (container) | ~3-7 minutes (container) | **Target <5 min (full VM)** — slower than containers but isolated |
| Infrastructure Type | Shared containers | Shared containers | Shared VMs | **Dedicated VMs per agent** — better isolation, required for openclaw-ansible |
| Progress Visibility | Generic "Deploying..." | Step-by-step logs | Build logs only | **5-step progress UI** — matches user research expectations |
| Region Selection | Auto (US-based) | 10+ regions | 4 regions | **2 regions (US-East, EU-Central)** — sufficient for v1, expand based on demand |
| Error Handling | Auto-retry on transient failures | Manual retry | Manual retry | **Auto-retry transient, manual retry permanent** — best of both worlds |
| SSH Access | Via web terminal | Via CLI (`railway run`) | Not offered | **Via Tailscale SSH + web terminal (v1.2)** — more secure than public SSH |
| Cost Transparency | Shown in dashboard | Shown in dashboard | Hidden until bill | **Show in dashboard** — builds trust, prevents bill shock |
| Auto-cleanup | Immediate on delete | 24-hour grace period | Immediate on delete | **Immediate Terraform destroy** — prevent orphaned costs |

**Key Differentiation**: Competitors use shared containers (faster, cheaper, less isolation). Aura uses dedicated VMs (slower, more expensive, full isolation) — justified by openclaw-ansible's requirement for root access, systemd, UFW, Docker daemon control. Our 5-min provision time competitive with other full-VM platforms (Render at 3-7 min).

## Sources

### Infrastructure Automation
- [Top 11 Automated Provisioning Tools in 2026 | Zluri](https://www.zluri.com/blog/automated-provisioning-tools)
- [Top 12 Cloud Provisioning Tools in 2026 | Spacelift](https://spacelift.io/blog/cloud-provisioning-tools)
- [Modern Automation with VMware Cloud Foundation Part 1 | VMware Blog](https://blogs.vmware.com/cloud-foundation/2026/02/03/modern-automation-with-vmware-cloud-foundation-part-1/)

### Infrastructure as Code
- [What is infrastructure as code (IaC)? | Microsoft Learn](https://learn.microsoft.com/en-us/devops/deliver/what-is-infrastructure-as-code)
- [Top 9 Infrastructure as Code Platforms for 2026 | SentinelOne](https://www.sentinelone.com/cybersecurity-101/cloud-security/infrastructure-as-code-platforms/)
- [16 Most Useful Infrastructure as Code (IaC) Tools for 2026 | Spacelift](https://spacelift.io/blog/infrastructure-as-code-tools)

### VPN and Networking
- [Tailscale | Secure Connectivity for AI, IoT & Multi-Cloud](https://tailscale.com/)
- [Private Networking on Hetzner Cloud with Tailscale | Onat Mercan's Blog](https://onatm.dev/2026/01/28/private-networking-on-hetzner-cloud-with-tailscale/)
- [Hands On with Tailscale Zero Trust Mesh VPN | Virtualization Review](https://virtualizationreview.com/articles/2024/03/18/hands-on-tailscale.aspx)

### Agent Lifecycle Management
- [Agent Lifecycle Management 2026: 6 Stages, Governance & ROI | OneReach.ai](https://onereach.ai/blog/agent-lifecycle-management-stages-governance-roi/)
- [AgentOps: The Next Evolution in AI Lifecycle Management | XenonStack](https://www.xenonstack.com/blog/agentops-ai)
- [What is SaaS Management? The 2026 Guide | BetterCloud](https://www.bettercloud.com/monitor/what-is-saas-management/)

### Hetzner Automation
- [Hetzner API overview | Official Docs](https://docs.hetzner.cloud/)
- [How I Am Setting Up VMs On Hetzner Cloud | Gunnar Morling](https://www.morling.dev/blog/how-i-am-setting-up-vms-on-hetzner-cloud/)
- [GitHub - ahoz/hetzner-autoprovision](https://github.com/ahoz/hetzner-autoprovision)

### Error Handling and Retry Patterns
- [Retry pattern | Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry)
- [Best practices for retry pattern | Medium](https://harish-bhattbhatt.medium.com/best-practices-for-retry-pattern-f29d47cd5117)
- [Error Handling & Retry Logic in Data Engineering | Medium](https://medium.com/data-engineering-technical-standards-and-best/error-handling-retry-logic-n-data-engineering-5e1922be8b01)

### Ansible and Systemd
- [Ansible Systemd Module Explained with Practical Examples | LinuxBuz](https://linuxbuz.com/devops/ansible-systemd-module-examples)
- [ansible.builtin.systemd module | Ansible Docs](https://docs.ansible.com/ansible/latest/collections/ansible/builtin/systemd_module.html)
- [Ansible: The Complete Guide for 2026 | DevToolbox](https://devtoolbox.dedyn.io/blog/ansible-complete-guide)

### Real-Time Updates and Webhooks
- [Webhooks as a Service | Svix](https://www.svix.com/use-cases/saas/)
- [Which unified API platform supports real-time webhooks? | unified.to](https://unified.to/blog/which_unified_api_platform_supports_real_time_webhooks)
- [What are Webhooks? An Explanation for the Non-Technical | Pandium](https://www.pandium.com/blogs/what-are-webhooks-an-explanation-for-the-non-technical)

### VM Lifecycle and Cleanup
- [Virtual Machine Lifecycle Management use cases | BMC Docs](https://docs.bmc.com/xwiki/bin/view/Automation-DevSecOps/Server-Automation/BMC-BladeLogic-Automation-Suite/bbas88/Key-concepts/Architecture/Configuration-Automation-functional-architecture/Virtual-Machine-Lifecycle-Management-use-cases/)
- [The Complete IT Life Cycle: What Organizations Should Expect in 2026 | Level IT](https://level.io/blog/it-life-cycle)
- [What is virtual infrastructure management? | Red Hat](https://www.redhat.com/en/topics/automation/virtual-infrastructure-management)

### Provisioning Rollback and Recovery
- [Failure Recovery in CI/CD: Best Practices | Hokstad Consulting](https://hokstadconsulting.com/blog/failure-recovery-in-ci-cd-best-practices)
- [Rollback Infra with Terraform Rollback step | Harness](https://developer.harness.io/docs/continuous-delivery/cd-infrastructure/terraform-infra/rollback-provisioned-infra-with-the-terraform-rollback-step/)
- [New for AWS CloudFormation – Retry Stack Operations from Point of Failure | AWS Blog](https://aws.amazon.com/blogs/aws/new-for-aws-cloudformation-quickly-retry-stack-operations-from-the-point-of-failure/)

### Monitoring and Observability
- [SaaS Monitoring | Datadog](https://www.datadoghq.com/monitoring/saas-monitoring/)
- [Top 10 Tools for Monitoring SaaS Availability and Uptime in 2026 | The Mantrix](https://themantrix.com/en/blog/Top-10-Tools-for-Monitoring-SaaS-Availability-and-Uptime-in-2026)
- [10 Best Cloud Logging Tools in 2026 | Better Stack](https://betterstack.com/community/comparisons/cloud-logging-tools/)
- [VM resource monitoring CPU memory disk SaaS dashboard | Grafana](https://grafana.com/grafana/dashboards/15334-server-metrics-cpu-memory-disk-network/)

### SSH Access and Console Management
- [Add SSH keys to VMs | Google Cloud Docs](https://docs.cloud.google.com/compute/docs/connect/add-ssh-keys)
- [VPS For SaaS Automation: 5 Powerful Benefits | TezHost](https://tezhost.com/benefits-of-using-a-vps-for-saas-automation/)
- [Accessing your VM Using SSH and the Web Console | Red Hat](https://www.redhat.com/en/blog/accessing-your-vm-using-ssh-and-the-web-console)

---
*Feature research for: Automated Agent Provisioning Infrastructure*
*Researched: 2026-02-13*
*Confidence: MEDIUM-HIGH (High on standard patterns, Medium on Hetzner-specific timings and Tailscale integration complexity)*
