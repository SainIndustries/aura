# Milestones

## v1.0 — Foundation (Shipped)

**Goal:** Build the core Aura platform — authentication, agent management, integrations, billing, and dashboard.

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

**Phases:** 1-5 (pre-GSD, built organically)

**Outcome:** Core platform functional with simulated agent provisioning.

---

## v1.1 — Infrastructure: Automated Agent Provisioning (Current)

**Goal:** Replace simulated provisioning with real infrastructure. Stripe payment triggers Hetzner VM creation, Ansible configuration, and Tailscale enrollment. Target: 50-200 agents.

**Started:** 2026-02-13
**GitHub:** Epic #6, Issue #16

---
*Last updated: 2026-02-13*
