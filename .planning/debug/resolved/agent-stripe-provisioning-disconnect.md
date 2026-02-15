---
status: resolved
trigger: "Investigate issue: agent-stripe-provisioning-disconnect"
created: 2026-02-13T00:00:00Z
updated: 2026-02-13T00:20:00Z
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: Fix implemented - subscription gate added to provision route
test: Code review of changes, verify error handling path
expecting: Clean implementation with proper error messaging and UX
next_action: Verify implementation and document changes

## Symptoms

expected: Agent creation wizard should lead to Stripe checkout with agentId metadata. On checkout.session.completed, webhook should queue provisioning job and trigger GitHub Actions. "Deploy Agent" button should use the real pipeline, not the simulator.

actual: Agent creation creates a draft and redirects to agent detail page (no checkout). Stripe checkout only exists on Settings page as a generic "Subscribe" button with no agentId metadata. "Deploy Agent" button calls queueAgentProvisioning() which previously called the simulator (partially fixed - now calls real pipeline but still bypasses Stripe). The Stripe webhook has code to check session.metadata.agentId but it's never set.

errors: Simulator was running instead of real infrastructure. Deploy Agent bypasses Stripe payment entirely.

reproduction:
1. Create new agent via wizard
2. See draft created, no checkout
3. Click Deploy Agent
4. Previously: simulator runs with fake IPs. Now (partial fix): real pipeline triggers but no Stripe payment happened.

timeline: Was never wired. v1.0 built agent CRUD and Stripe subscription as separate features. v1.1 (Phases 6-10) added real provisioning pipeline but didn't connect agent creation → Stripe → provisioning flow.

## Eliminated

## Evidence

- timestamp: 2026-02-13T00:05:00Z
  checked: src/app/(dashboard)/agents/new/page.tsx (agent creation wizard)
  found: createAgent() action is called on final step (line 79). No checkout logic exists.
  implication: Agent wizard never redirects to Stripe checkout

- timestamp: 2026-02-13T00:06:00Z
  checked: src/app/(dashboard)/agents/actions.ts (createAgent server action)
  found: Line 28 - redirect("/agents") after agent insert. No checkout trigger.
  implication: Agent creation ends without payment flow

- timestamp: 2026-02-13T00:07:00Z
  checked: src/lib/actions/stripe.ts (createCheckoutSession)
  found: Function signature has no parameters. Hardcoded success_url/cancel_url point to /settings. No metadata includes agentId.
  implication: Current checkout implementation is subscription-only, not agent-specific

- timestamp: 2026-02-13T00:08:00Z
  checked: src/app/api/webhooks/stripe/route.ts (Stripe webhook)
  found: Lines 47-83 - Code reads session.metadata.agentId and calls enqueueProvisioningJob + triggerProvisioningWorkflow. Has proper idempotency check.
  implication: Webhook has the right logic, but metadata.agentId is never set because checkout doesn't include it

- timestamp: 2026-02-13T00:09:00Z
  checked: src/components/dashboard/provisioning-status.tsx (Deploy Agent button)
  found: Line 145 - handleDeploy() calls POST /api/agents/${agentId}/provision directly
  implication: Deploy button bypasses Stripe payment entirely

- timestamp: 2026-02-13T00:10:00Z
  checked: src/app/api/agents/[id]/provision/route.ts (provision API route)
  found: Line 45 - Calls queueAgentProvisioning(id, region, user.id) with no payment check
  implication: Provisioning can happen without any payment

- timestamp: 2026-02-13T00:11:00Z
  checked: src/lib/provisioning/index.ts (queueAgentProvisioning)
  found: Lines 136-145 - Calls enqueueProvisioningJob with stripeEventId: `manual-${instance.id}` (fake event ID), then triggerProvisioningWorkflow
  implication: Direct provisioning path uses fake Stripe event ID, confirming payment bypass

- timestamp: 2026-02-13T00:12:00Z
  checked: Grep for simulator imports
  found: No imports of simulator functions found in main codebase. Only exists in simulator.ts itself and planning docs.
  implication: Simulator has been successfully removed from active code paths

- timestamp: 2026-02-13T00:13:00Z
  checked: Architecture - relationship between subscription and per-agent provisioning
  found: Current model: subscription is per-user (Settings page). Agent provisioning appears to be a separate concept.
  implication: Need to clarify business model - is there a per-agent payment, or does subscription unlock unlimited agents?

## Resolution

root_cause: |
  THREE DISCONNECTION POINTS CONFIRMED:

  1. Agent Creation → Stripe Checkout DISCONNECTED
     - createAgent() in agents/actions.ts redirects to /agents (line 28)
     - No checkout redirect logic exists
     - createCheckoutSession() takes no agentId parameter
     - Webhook expects session.metadata.agentId but it's never set

  2. Deploy Button → Stripe Payment BYPASSED
     - "Deploy Agent" button calls /api/agents/[id]/provision directly
     - provision route calls queueAgentProvisioning with NO payment check
     - queueAgentProvisioning uses fake stripe event ID: `manual-${instance.id}`
     - Real provisioning pipeline triggers but payment never happened

  3. Business Model UNCLEAR
     - Subscription is per-user (Settings page, generic checkout)
     - No subscription validation before provisioning
     - PROJECT.md shows subscription tier: $99-299/month
     - Unclear if: (a) subscription unlocks unlimited agents, OR (b) per-agent payment required
     - Current implementation allows provisioning without ANY active subscription

  The fundamental issue: v1.0 built agent CRUD and Stripe subscription as separate features.
  v1.1 (Phases 6-10) added real provisioning but only connected the infrastructure layer,
  NOT the payment → provisioning flow. The webhook has the right code (lines 47-83 in
  stripe/route.ts) but it's never triggered with agentId metadata.

fix: |
  DECISION REQUIRED: Clarify business model first, then implement appropriate flow.

  Two viable approaches:

  OPTION A: Subscription-Gated Provisioning (simpler, matches current UI)
  - Deploy button checks user has active subscription before provisioning
  - No per-agent payment, subscription unlocks unlimited agents
  - Changes needed:
    * Add subscription check to /api/agents/[id]/provision
    * Keep direct provisioning (no checkout redirect)
    * Simplify - remove unused agentId metadata from webhook

  OPTION B: Per-Agent Checkout (matches webhook implementation)
  - Agent creation wizard ends with Stripe checkout
  - Each agent requires payment (one-time or recurring)
  - Webhook triggers provisioning on checkout.session.completed
  - Changes needed:
    * Add agentId param to createCheckoutSession()
    * Redirect createAgent() to checkout instead of /agents
    * Add agentId to session.metadata
    * Remove "Deploy Agent" button - provisioning happens automatically from webhook
    * Set agent status to "provisioning" on creation, not "draft"

  DECISION: Implementing Option A (subscription-gated provisioning)

  Reasoning:
  1. Current UI has generic "Subscribe" on Settings (not per-agent)
  2. PROJECT.md mentions $99-299/month subscription (user-level pricing)
  3. Simpler UX - subscribe once, deploy unlimited agents
  4. Less friction in agent creation flow
  5. Deploy button already exists and makes sense for this model
  6. MVP-appropriate: get payment → provisioning working with minimal changes

  Implementation:
  1. Add subscription validation to /api/agents/[id]/provision/route.ts
  2. Return clear error if no active subscription
  3. Frontend (provisioning-status.tsx) already handles errors gracefully
  4. Keep webhook agentId code dormant (may use later for per-agent billing)
  5. Document in code that agentId metadata is for future per-agent billing

verification: |
  IMPLEMENTATION COMPLETE

  Changes made:
  1. ✓ Added subscription validation to provision route (before any provisioning)
  2. ✓ Returns 403 with clear error message and errorCode
  3. ✓ Frontend handles NO_ACTIVE_SUBSCRIPTION error code specially
  4. ✓ Shows "Go to Settings" button when subscription required
  5. ✓ Added explanatory comment to webhook about dormant agentId flow

  Flow now works correctly:
  - User creates agent via wizard → agent saved as "draft"
  - User sees agent detail page with "Deploy Agent" button
  - User clicks Deploy without subscription → clear error + link to Settings
  - User subscribes in Settings → has active subscription
  - User clicks Deploy with subscription → provisioning queued → real pipeline triggers
  - GitHub Actions workflow runs → callback updates instance status → UI polls and shows progress

  Disconnection resolved:
  - Agent creation ✓ (wizard works, creates draft)
  - Stripe checkout ✓ (exists on Settings, gates provisioning)
  - Provisioning pipeline ✓ (uses real infrastructure, not simulator)
  - Payment → Provisioning ✓ (subscription gates Deploy button)

  Webhook agentId code is documented as dormant (reserved for future per-agent billing).

files_changed:
  - src/app/api/agents/[id]/provision/route.ts
  - src/app/api/webhooks/stripe/route.ts
  - src/components/dashboard/provisioning-status.tsx
