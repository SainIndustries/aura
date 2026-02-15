# Aura

## What This Is

Aura is a SaaS platform for deploying and managing AI agents. Users sign up, configure an agent with a persona and integrations, and Aura provisions an isolated instance that runs 24/7. The platform handles authentication, billing, 50+ OAuth integrations, and multi-channel communication (Slack, WhatsApp, Telegram, web, etc.).

## Core Value

Users can deploy a fully configured, always-on AI agent without touching infrastructure — sign up, pay, and your agent is running.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Authentication via Privy (email, Google, GitHub, SMS, passkey) — v1.0
- ✓ Dashboard with agent management (create, edit, delete) — v1.0
- ✓ Multi-step agent creation wizard with LLM provider config — v1.0
- ✓ Chat interface with OpenAI GPT-4o-mini — v1.0
- ✓ 50+ OAuth integrations with encrypted token storage — v1.0
- ✓ Channel management (Web, Slack, Telegram, WhatsApp, Discord, Email, Phone) — v1.0
- ✓ Team management with invites — v1.0
- ✓ Stripe billing and subscriptions — v1.0
- ✓ Onboarding flow — v1.0
- ✓ Audit logging — v1.0
- ✓ Agent templates — v1.0
- ✓ Settings page — v1.0
- ✓ Marketing pages (landing, privacy, terms) — v1.0
- ✓ Rate limiting (Upstash Redis) — v1.0
- ✓ Error tracking (Sentry) — v1.0
- ✓ Transactional email (Resend) — v1.0

### Active

<!-- Current scope. Building toward these. -->

- [ ] Automated agent provisioning on Hetzner Cloud via Terraform
- [ ] openclaw-ansible adaptation for remote deployment
- [ ] Tailscale network enrollment and ACL management
- [ ] Agent lifecycle management (provision, monitor, suspend, resume, destroy)
- [ ] Real-time provisioning status updates to dashboard
- [ ] Multi-region support (US-East, EU-Central)
- [ ] Automated pipeline via GitHub Actions
- [ ] Health monitoring and alerting

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Kubernetes orchestration — overkill for 50-200 agents, revisit at 1000+
- Multi-cloud (AWS/GCP) — Hetzner sufficient for current scale
- Load balancing — not needed with per-agent VMs
- White-glove/on-prem deployment — separate epic (#7)
- Agent wallets/transactions — separate epic (#18)

## Current Milestone: v1.1 Infrastructure — Automated Agent Provisioning

**Goal:** Replace simulated provisioning with real infrastructure — Stripe payment triggers automated Hetzner VM creation, Ansible configuration, and Tailscale enrollment. Target: 50-200 agents.

**Target features:**
- Hetzner Cloud VM provisioning via Terraform
- openclaw-ansible remote deployment
- Tailscale networking for all instances
- Agent lifecycle management (provision → running → suspended → destroyed)
- Automated pipeline via GitHub Actions
- Real-time status reporting to dashboard
- Multi-region (US-East + EU-Central)
- Health monitoring and alerting

## Context

- Currently uses simulated provisioning (`src/lib/provisioning/simulator.ts`)
- openclaw-ansible playbook requires root access, systemd, UFW, Docker daemon — Railway incompatible
- Hetzner 60-80% cheaper than AWS/GCP for equivalent compute
- CPX11 (2 vCPU, 2GB) ~$5/mo per agent, CPX21 (3 vCPU, 4GB) ~$8.50/mo
- Tailscale free up to 100 devices, $6/user/month for teams
- At $99-299/month subscription, infrastructure cost is <5%
- GitHub issues: Epic #6 (SaaS Deployment Infrastructure), #16 (Scaling Strategy)

## Constraints

- **Infrastructure**: Hetzner Cloud — chosen for cost and API simplicity
- **Networking**: Tailscale — secure mesh networking for all instances
- **IaC**: Terraform — state management and reproducible infrastructure
- **Configuration**: Ansible (openclaw-ansible fork) — server hardening and agent setup
- **CI/CD**: GitHub Actions — automated provisioning pipeline
- **Provisioning SLA**: <5 minutes end-to-end from payment to running agent
- **Compatibility**: Must integrate with existing Stripe webhook flow

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hetzner over AWS/GCP | 60-80% cheaper, simple API, good Terraform provider | — Pending |
| Tailscale over WireGuard manual | Auto-enrollment, ACLs, MagicDNS, Tailscale SSH | — Pending |
| Terraform over Pulumi | Wider ecosystem, team familiarity, Hetzner provider mature | — Pending |
| Per-VM isolation over containers | Security isolation, openclaw-ansible requires full OS | — Pending |
| Railway rejected | No root access, systemd, UFW, Docker daemon control | ✓ Good |

---
*Last updated: 2026-02-13 after milestone v1.1 initialization*
