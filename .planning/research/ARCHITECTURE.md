# Architecture Research: Automated Agent Provisioning Infrastructure

**Domain:** Infrastructure orchestration for SaaS platform with automated VM provisioning
**Researched:** 2026-02-13
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER (Vercel)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Next.js    │  │   API        │  │  Webhooks    │              │
│  │   Frontend   │  │   Routes     │  │  (Stripe)    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                        │
├─────────┴─────────────────┴─────────────────┴────────────────────────┤
│                      ORCHESTRATION LAYER                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              GitHub Actions Workflow Runner                  │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │    │
│  │  │Terraform │  │ Hetzner  │  │ Ansible  │  │Tailscale │    │    │
│  │  │   CLI    │  │   API    │  │   CLI    │  │   API    │    │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │    │
│  └─────────────────────────────────────────────────────────────┘    │
├───────────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  PostgreSQL  │  │   S3/R2      │  │  Terraform   │              │
│  │    (Neon)    │  │   (State)    │  │   Cloud      │              │
│  │   App Data   │  │  TF State    │  │  (Optional)  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
├───────────────────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Hetzner VM  │  │  Hetzner VM  │  │  Hetzner VM  │              │
│  │   (Agent 1)  │  │   (Agent 2)  │  │   (Agent N)  │              │
│  │  Tailscale   │  │  Tailscale   │  │  Tailscale   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Next.js API Routes** | Accept provisioning requests, trigger workflows, track status | Serverless functions on Vercel (10s timeout) |
| **GitHub Actions Runner** | Execute long-running infrastructure tasks (Terraform, Ansible) | Self-hosted or GitHub-hosted runners with secrets |
| **Terraform** | Declaratively provision Hetzner VMs, manage infrastructure state | CLI with remote state backend (S3/Cloudflare R2) |
| **Hetzner API** | Create/delete servers, manage networking, snapshots | Node.js SDK (`hcloud-js` or REST API) |
| **Ansible** | Configure VMs, install agent runtime, setup services | Playbooks run via GitHub Actions or remote executor |
| **Tailscale** | Create secure mesh network, assign IPs, manage devices | REST API for device management |
| **PostgreSQL** | Track provisioning jobs, agent-to-VM mapping, status lifecycle | Drizzle ORM with `agent_instances` table |
| **State Backend** | Store Terraform state files per agent instance | S3-compatible storage (R2) with locking |

## Recommended Project Structure

```
aura/
├── src/
│   ├── app/api/
│   │   ├── agents/[id]/provision/route.ts      # Trigger provisioning (exists)
│   │   ├── agents/[id]/instance/route.ts       # Get/delete instance (exists)
│   │   └── provisioning/
│   │       ├── webhook/route.ts                # NEW: GitHub Actions callback
│   │       └── status/[instanceId]/route.ts    # NEW: Status polling endpoint
│   ├── lib/
│   │   ├── provisioning/
│   │   │   ├── index.ts                        # EXISTING: Core provisioning logic
│   │   │   ├── simulator.ts                    # EXISTING: Mock provisioner (remove later)
│   │   │   ├── github-actions.ts               # NEW: Trigger workflow via repo dispatch
│   │   │   ├── hetzner.ts                      # NEW: Hetzner API client wrapper
│   │   │   ├── tailscale.ts                    # NEW: Tailscale API client
│   │   │   └── state-manager.ts                # NEW: Terraform state tracking
│   │   └── db/schema.ts                        # MODIFY: Add infrastructure_state table
│   └── components/dashboard/
│       └── provisioning-status.tsx             # EXISTING: Status UI (already wired)
├── .github/
│   └── workflows/
│       ├── provision-agent.yml                 # NEW: Main provisioning workflow
│       ├── terminate-agent.yml                 # NEW: Cleanup workflow
│       └── ansible-deploy.yml                  # NEW: Configuration workflow (optional split)
├── infrastructure/
│   ├── terraform/
│   │   ├── modules/
│   │   │   └── hetzner-agent-vm/
│   │   │       ├── main.tf                     # NEW: VM provisioning module
│   │   │       ├── variables.tf                # NEW: Region, size, ssh keys
│   │   │       └── outputs.tf                  # NEW: Server IP, ID
│   │   ├── backend.tf                          # NEW: S3/R2 backend config (per-instance workspace)
│   │   └── main.tf                             # NEW: Root module
│   └── ansible/
│       ├── playbooks/
│       │   ├── setup-agent.yml                 # NEW: Install runtime, configure agent
│       │   └── teardown-agent.yml              # NEW: Cleanup before destroy
│       ├── roles/
│       │   ├── common/                         # NEW: Base system setup
│       │   ├── tailscale/                      # NEW: VPN setup
│       │   └── agent-runtime/                  # NEW: Agent-specific config
│       └── inventory/
│           └── dynamic_inventory.py            # NEW: Query PostgreSQL for active instances
└── scripts/
    ├── provision-local.sh                      # NEW: Local testing script (optional)
    └── generate-ansible-inventory.ts           # NEW: DB → Ansible inventory converter
```

### Structure Rationale

- **`infrastructure/` folder:** Separates IaC from application code. Terraform and Ansible should be versioned alongside app code but clearly isolated.
- **`lib/provisioning/`:** Business logic for orchestrating infrastructure. API routes call these functions, which in turn trigger GitHub Actions or external services.
- **GitHub Actions workflows:** Long-running tasks (Terraform apply takes 2-5min, Ansible 3-10min) exceed serverless timeout limits (10s on Vercel). GitHub Actions provides durable execution environment with secrets management.
- **Dynamic inventory:** Ansible needs to know which VMs exist. Instead of static files, query PostgreSQL `agent_instances` table to generate inventory at runtime.
- **Per-instance Terraform workspaces:** Each agent gets isolated state to enable independent provisioning/destruction without affecting other agents.

## Architectural Patterns

### Pattern 1: Webhook-Triggered CI/CD Orchestration

**What:** API routes trigger infrastructure provisioning by dispatching webhook events to GitHub Actions workflows, which execute Terraform and Ansible. Workflows callback to API with status updates.

**When to use:** When infrastructure tasks exceed serverless function timeout limits (10s Vercel, 15min AWS Lambda max). Needed for Terraform (2-5min), Ansible (3-10min), and combined pipeline (5-15min).

**Trade-offs:**
- **Pros:** No timeout limits, built-in secrets management, workflow state persistence, retry logic, logs UI
- **Cons:** Added latency (5-15s to start workflow), dependency on GitHub availability, need webhook callback for status updates

**Example:**
```typescript
// src/lib/provisioning/github-actions.ts
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

export async function triggerProvisioningWorkflow(instanceId: string, config: {
  region: string;
  serverType: string;
  agentId: string;
}) {
  // Dispatch repository_dispatch event to trigger workflow
  await octokit.repos.createDispatchEvent({
    owner: 'your-org',
    repo: 'aura',
    event_type: 'provision_agent',
    client_payload: {
      instance_id: instanceId,
      region: config.region,
      server_type: config.serverType,
      agent_id: config.agentId,
      callback_url: `${process.env.APP_URL}/api/provisioning/webhook`,
    }
  });

  return { workflowTriggered: true, instanceId };
}
```

### Pattern 2: Database-Driven State Machine

**What:** Track provisioning state in PostgreSQL with status enum progression. Each state transition triggers corresponding infrastructure action. Database is source of truth for provisioning status, not Terraform state.

**When to use:** When you need to show real-time status to users, coordinate between async workers, and maintain audit trail. Essential for SaaS where users monitor deployment progress.

**Trade-offs:**
- **Pros:** Single source of truth, enables real-time UI updates, provides audit trail, survives infrastructure failures
- **Cons:** State can drift from actual infrastructure if callbacks fail, requires reconciliation logic

**Example:**
```typescript
// Status lifecycle in database
const PROVISIONING_STATES = {
  PENDING: 'pending',           // Queued, waiting for workflow
  PROVISIONING: 'provisioning', // Terraform/Ansible running
  RUNNING: 'running',           // VM active, agent started
  STOPPING: 'stopping',         // Teardown initiated
  STOPPED: 'stopped',           // VM destroyed
  FAILED: 'failed',             // Error occurred
} as const;

// Transition logic
export async function transitionInstanceState(
  instanceId: string,
  targetState: ProvisioningStatus['status'],
  metadata?: { serverId?: string; serverIp?: string; error?: string }
) {
  const [updated] = await db
    .update(agentInstances)
    .set({
      status: targetState,
      ...metadata,
      updatedAt: new Date(),
    })
    .where(eq(agentInstances.id, instanceId))
    .returning();

  // Emit event for logging/monitoring
  await auditLog.create({
    category: 'infrastructure',
    action: `instance_state_${targetState}`,
    metadata: { instanceId, ...metadata },
  });

  return updated;
}
```

### Pattern 3: Per-Instance Terraform Workspace with Remote State

**What:** Each agent instance gets isolated Terraform workspace. State stored in S3/R2 with DynamoDB/database locking. Workspace name = `agent-{instanceId}`. Enables independent provisioning/destruction without state conflicts.

**When to use:** When managing multiple infrastructure instances that should be independently mutable. Required for SaaS where users provision/destroy agents independently.

**Trade-offs:**
- **Pros:** No state conflicts, parallel provisioning, independent lifecycle management, easy to destroy single instance
- **Cons:** More state files to manage, workspace naming must be consistent, cleanup requires destroying workspace AND state file

**Example:**
```hcl
# infrastructure/terraform/backend.tf
terraform {
  backend "s3" {
    bucket         = "aura-terraform-state"
    key            = "agents/${var.instance_id}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "aura-terraform-locks"

    # Use Cloudflare R2 (S3-compatible) alternative:
    # endpoint                    = "https://[account].r2.cloudflarestorage.com"
    # skip_credentials_validation = true
    # skip_region_validation      = true
  }
}

variable "instance_id" {
  type        = string
  description = "Agent instance UUID for workspace isolation"
}
```

```yaml
# .github/workflows/provision-agent.yml
- name: Initialize Terraform with workspace
  run: |
    cd infrastructure/terraform
    terraform init -reconfigure \
      -backend-config="key=agents/${{ github.event.client_payload.instance_id }}/terraform.tfstate"
    terraform workspace select -or-create=true agent-${{ github.event.client_payload.instance_id }}
    terraform apply -auto-approve \
      -var="instance_id=${{ github.event.client_payload.instance_id }}" \
      -var="region=${{ github.event.client_payload.region }}"
```

### Pattern 4: Callback-Based Status Updates

**What:** GitHub Actions workflows POST status updates to API webhook endpoint as they progress through steps. API updates database and notifies frontend via polling or WebSockets.

**When to use:** When long-running workflows need to communicate progress back to application. Essential for showing real-time provisioning status to users.

**Trade-offs:**
- **Pros:** Real-time updates, clear separation of concerns, can add steps without changing API
- **Cons:** Requires secure webhook authentication, network failures can cause status drift, need reconciliation

**Example:**
```yaml
# .github/workflows/provision-agent.yml
name: Provision Agent

on:
  repository_dispatch:
    types: [provision_agent]

jobs:
  provision:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Update status - Provisioning
        run: |
          curl -X POST "${{ github.event.client_payload.callback_url }}" \
            -H "Authorization: Bearer ${{ secrets.WEBHOOK_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{
              "instance_id": "${{ github.event.client_payload.instance_id }}",
              "status": "provisioning",
              "step": "terraform_init"
            }'

      - name: Terraform Apply
        run: |
          cd infrastructure/terraform
          terraform init -reconfigure
          terraform apply -auto-approve \
            -var="instance_id=${{ github.event.client_payload.instance_id }}"

      - name: Capture Terraform Outputs
        id: tf_outputs
        run: |
          cd infrastructure/terraform
          echo "server_ip=$(terraform output -raw server_ip)" >> $GITHUB_OUTPUT
          echo "server_id=$(terraform output -raw server_id)" >> $GITHUB_OUTPUT

      - name: Update status - Configuring
        run: |
          curl -X POST "${{ github.event.client_payload.callback_url }}" \
            -H "Authorization: Bearer ${{ secrets.WEBHOOK_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{
              "instance_id": "${{ github.event.client_payload.instance_id }}",
              "status": "provisioning",
              "step": "ansible_configure",
              "server_id": "${{ steps.tf_outputs.outputs.server_id }}",
              "server_ip": "${{ steps.tf_outputs.outputs.server_ip }}"
            }'

      - name: Run Ansible Playbook
        run: |
          cd infrastructure/ansible
          ansible-playbook -i "${{ steps.tf_outputs.outputs.server_ip }}," \
            playbooks/setup-agent.yml \
            -e "agent_id=${{ github.event.client_payload.agent_id }}" \
            -e "instance_id=${{ github.event.client_payload.instance_id }}"

      - name: Update status - Running
        run: |
          curl -X POST "${{ github.event.client_payload.callback_url }}" \
            -H "Authorization: Bearer ${{ secrets.WEBHOOK_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{
              "instance_id": "${{ github.event.client_payload.instance_id }}",
              "status": "running",
              "started_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
            }'

      - name: Update status - Failed (on error)
        if: failure()
        run: |
          curl -X POST "${{ github.event.client_payload.callback_url }}" \
            -H "Authorization: Bearer ${{ secrets.WEBHOOK_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{
              "instance_id": "${{ github.event.client_payload.instance_id }}",
              "status": "failed",
              "error": "Workflow failed at step: ${{ github.job }}"
            }'
```

## Data Flow

### Provisioning Request Flow

```
[User clicks "Deploy Agent" in UI]
    ↓
[POST /api/agents/{id}/provision]
    ↓
[queueAgentProvisioning(agentId, region)]
    ↓
[DB: INSERT agent_instances (status: 'pending')]
    ↓
[triggerProvisioningWorkflow(instanceId, config)]
    ↓
[GitHub API: repository_dispatch event]
    ↓
[GitHub Actions: provision-agent.yml triggered]
    ↓
┌─────────────────────────────────────────────┐
│  Workflow Steps (GitHub Actions Runner)    │
├─────────────────────────────────────────────┤
│  1. Terraform init + workspace select       │
│     ↓                                       │
│  2. Terraform apply (create Hetzner VM)     │
│     ↓                                       │
│  3. Callback: status=provisioning, serverIp │
│     ↓                                       │
│  4. Wait for VM SSH ready (~30s)            │
│     ↓                                       │
│  5. Ansible playbook (configure VM)         │
│     ↓                                       │
│  6. Tailscale API (join device to network)  │
│     ↓                                       │
│  7. Callback: status=running, tailscaleIp   │
└─────────────────────────────────────────────┘
    ↓
[POST /api/provisioning/webhook] (callback from workflow)
    ↓
[DB: UPDATE agent_instances (status, IPs, timestamps)]
    ↓
[Frontend: Polling GET /api/agents/{id}/instance shows "running"]
```

### Status Polling Flow

```
[Frontend: ProvisioningStatus component mounted]
    ↓
[useEffect: Start polling interval (1s)]
    ↓
[GET /api/agents/{agentId}/instance]
    ↓
[Query: SELECT * FROM agent_instances WHERE agent_id = ?]
    ↓
[Return: { instance: { status, serverIp, tailscaleIp, ... }, steps, uptime }]
    ↓
[Frontend: Render status badge, progress steps, server details]
    ↓
[If status = 'pending' | 'provisioning' | 'stopping': Continue polling]
[If status = 'running' | 'stopped' | 'failed': Stop polling, update uptime only]
```

### Termination Flow

```
[User clicks "Stop Instance" in UI]
    ↓
[DELETE /api/agents/{id}/instance]
    ↓
[stopAgentInstance(agentId)]
    ↓
[DB: UPDATE agent_instances SET status='stopping']
    ↓
[triggerTerminationWorkflow(instanceId, serverId)]
    ↓
[GitHub Actions: terminate-agent.yml triggered]
    ↓
┌─────────────────────────────────────────────┐
│  Termination Workflow Steps                 │
├─────────────────────────────────────────────┤
│  1. Ansible playbook: teardown-agent.yml    │
│     (Stop services, backup data if needed)  │
│     ↓                                       │
│  2. Tailscale API: Remove device            │
│     ↓                                       │
│  3. Terraform destroy (delete VM)           │
│     ↓                                       │
│  4. Callback: status=stopped, stoppedAt     │
│     ↓                                       │
│  5. Clean up Terraform state (optional)     │
└─────────────────────────────────────────────┘
    ↓
[POST /api/provisioning/webhook]
    ↓
[DB: UPDATE agent_instances (status='stopped', stoppedAt)]
    ↓
[Frontend: Show "Deploy Agent" button again]
```

### Key Data Flows

1. **Application State → Infrastructure State:** PostgreSQL `agent_instances` table stores desired state (user wants agent running). GitHub Actions workflows reconcile actual infrastructure to match desired state.

2. **Infrastructure State → Application State:** Workflows report back infrastructure details (IPs, server IDs) via webhook callbacks. Application updates database with actual infrastructure state.

3. **Terraform State Isolation:** Each agent instance has isolated Terraform workspace and state file. State stored in S3/R2 with path `agents/{instanceId}/terraform.tfstate`. No shared state = no conflicts.

4. **Ansible Dynamic Inventory:** At runtime, Ansible queries PostgreSQL for all instances with `status='provisioning'` to generate inventory. This ensures Ansible only targets VMs that should exist.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **1-50 agents** | Single GitHub Actions runner, S3/R2 for Terraform state, Ansible runs serially. Provisioning: 1-2 agents/min. Current architecture sufficient. |
| **50-200 agents (target)** | Self-hosted GitHub Actions runners (3-5 runners), parallel provisioning workflows. Database connection pooling (Neon scales automatically). Terraform state in R2 with per-instance workspaces. Provisioning: 5-10 agents/min. |
| **200-1000 agents** | Dedicated provisioning queue (BullMQ/SQS), 10+ self-hosted runners, rate limiting for Hetzner API (20 req/s). Consider Terraform Cloud API for state management and parallel runs. Database read replicas for status polling. Provisioning: 15-30 agents/min. |
| **1000+ agents** | Multi-region provisioning (split US/EU workflows), dedicated provisioning service (separate from Next.js), event-driven architecture (Kafka/EventBridge). Consider managed Ansible (Ansible Automation Platform) or alternatives (Salt, Puppet). Database sharding by region. Provisioning: 50+ agents/min. |

### Scaling Priorities

1. **First bottleneck (50-100 agents):** GitHub Actions concurrency limits. Default: 20 concurrent jobs for free tier, 60 for Pro, 180 for Team. **Fix:** Self-hosted runners (5-10 instances) or upgrade GitHub plan.

2. **Second bottleneck (100-200 agents):** Hetzner API rate limits (varies by endpoint, typically 100-200 req/min). **Fix:** Implement exponential backoff, queue requests, batch operations where possible. Contact Hetzner for rate limit increase for production use.

3. **Third bottleneck (200-500 agents):** Terraform state locking contention if multiple workflows try to manage same state. **Fix:** Already mitigated by per-instance workspaces. Ensure no shared state files.

4. **Fourth bottleneck (500-1000 agents):** Database connection limits from polling frontend clients. Neon default: 100 connections. **Fix:** Implement WebSocket or Server-Sent Events for status updates instead of polling. Use PgBouncer for connection pooling.

## Anti-Patterns

### Anti-Pattern 1: Running Terraform Directly from API Routes

**What people do:** Execute `terraform apply` subprocess from Next.js API route to provision infrastructure immediately in response to user request.

**Why it's wrong:**
- Serverless function timeouts (10s Vercel, 15min AWS Lambda max) kill long-running Terraform operations
- No retry mechanism if process crashes
- No log persistence
- Cannot handle concurrent requests (Terraform state locking)
- Secrets must be in application environment (security risk)

**Do this instead:** Trigger GitHub Actions workflow via `repository_dispatch` event. Workflow runs Terraform with proper timeout, logging, retry logic, and secrets management. Communicate status back via webhook.

### Anti-Pattern 2: Shared Terraform State Across All Agents

**What people do:** Single `terraform.tfstate` file managing all Hetzner VMs. Terraform manages 50-200 resources in one state file.

**Why it's wrong:**
- Cannot provision agents in parallel (state locking)
- Destroying one agent requires touching state for all agents (risk of accidental destruction)
- Drift in one agent affects entire state
- Slow Terraform operations as resource count grows (plan/apply scans all resources)
- State corruption affects all infrastructure

**Do this instead:** Per-instance Terraform workspaces with isolated state files. Each agent gets `agents/{instanceId}/terraform.tfstate`. Provision/destroy operations are independent and parallel.

### Anti-Pattern 3: Polling Terraform/Ansible for Status

**What people do:** API route checks Terraform state or runs `terraform show` to get provisioning status.

**Why it's wrong:**
- State file may not reflect current operation (shows previous state until apply completes)
- Adds load to state backend
- Cannot show in-progress status ("Creating server..." vs "Configuring agent...")
- Requires Terraform credentials in API environment
- No audit trail of status changes

**Do this instead:** Database-driven state machine. Workflows update PostgreSQL as they progress. API queries database for status. Database is source of truth for application state; Terraform state tracks infrastructure state.

### Anti-Pattern 4: Static Ansible Inventory Files

**What people do:** Maintain `hosts.ini` file with list of agent VM IPs. Update file each time agent is provisioned/destroyed.

**Why it's wrong:**
- Inventory file drifts from actual infrastructure
- Race conditions when multiple workflows update file
- Cannot target specific agent for re-configuration
- Manual maintenance required
- VCS conflicts if inventory in git

**Do this instead:** Dynamic inventory script that queries PostgreSQL `agent_instances` table. Ansible fetches current list of VMs at runtime. Single source of truth (database), no drift, no manual updates.

### Anti-Pattern 5: Embedding Infrastructure Credentials in Application Code

**What people do:** Store Hetzner API token, Tailscale API key, SSH private keys in Next.js environment variables accessible to API routes.

**Why it's wrong:**
- Application doesn't need infrastructure credentials (API routes don't provision directly)
- Increases blast radius if application is compromised
- Credentials logged in serverless function logs
- Violates principle of least privilege

**Do this instead:** Store credentials as GitHub repository secrets. Only accessible to GitHub Actions workflows. Application only needs GitHub PAT for triggering workflows (scoped to `repo` permission). Separate credential domains by privilege level.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Hetzner Cloud API** | Node.js SDK (`hcloud-js`) or REST API from GitHub Actions | Rate limits: ~100-200 req/min. Use API token (read+write). Store in GitHub secrets. |
| **Tailscale API** | REST API via `fetch()` or SDK. Create auth keys, manage devices | API token requires `devices:write` scope. Pre-auth keys for automatic device joining. |
| **Terraform Cloud** (optional) | API-driven workflow for remote state + runs management | Alternative to S3/R2 backend. Provides UI, RBAC, cost estimation. Overkill for <200 agents. |
| **GitHub API** | Octokit SDK to trigger `repository_dispatch` events | Requires PAT with `repo` scope or GitHub App installation token. |
| **Neon PostgreSQL** | Drizzle ORM from API routes, direct connections from workflows | Connection string in environment. Enable connection pooling for >100 concurrent connections. |
| **Cloudflare R2 / S3** | Terraform S3 backend for state storage | S3-compatible API. Cheaper than S3 for storage. Enable versioning and encryption. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Next.js API ↔ GitHub Actions** | Webhook (repository_dispatch → callback) | Async, eventual consistency. API triggers workflow; workflow calls back with status updates. |
| **GitHub Actions ↔ Terraform** | CLI subprocess execution | Workflow runs `terraform init/plan/apply`. Outputs captured via `terraform output -json`. |
| **GitHub Actions ↔ Ansible** | CLI subprocess execution | Workflow runs `ansible-playbook`. Dynamic inventory queries database. |
| **Terraform ↔ Hetzner API** | Hetzner Terraform provider | Provider calls Hetzner REST API. Handles retries and rate limiting. |
| **Ansible ↔ Agent VMs** | SSH (port 22) | Requires SSH key authentication. Public key in Terraform, private key in GitHub secrets. |
| **Database ↔ All Components** | Direct SQL connections (Drizzle ORM / psql) | API routes use Drizzle. Workflows use `psql` or Node.js scripts. Connection pooling via Neon. |
| **Frontend ↔ API** | REST API (polling) | Frontend polls `/api/agents/{id}/instance` every 1s during active provisioning. Consider WebSockets for production. |

## New vs Modified Components

### New Components (To Build)

| Component | Type | Purpose |
|-----------|------|---------|
| `.github/workflows/provision-agent.yml` | GitHub Actions Workflow | Orchestrates Terraform + Ansible provisioning |
| `.github/workflows/terminate-agent.yml` | GitHub Actions Workflow | Destroys VM and cleans up resources |
| `infrastructure/terraform/modules/hetzner-agent-vm/` | Terraform Module | Provisions Hetzner VM with networking |
| `infrastructure/ansible/playbooks/setup-agent.yml` | Ansible Playbook | Configures VM, installs agent runtime |
| `infrastructure/ansible/inventory/dynamic_inventory.py` | Python Script | Queries PostgreSQL for active instances |
| `src/app/api/provisioning/webhook/route.ts` | Next.js API Route | Receives status callbacks from GitHub Actions |
| `src/lib/provisioning/github-actions.ts` | TypeScript Module | Triggers workflows via GitHub API |
| `src/lib/provisioning/hetzner.ts` | TypeScript Module | Hetzner API client wrapper (optional, mostly in Terraform) |
| `src/lib/provisioning/tailscale.ts` | TypeScript Module | Tailscale API client for device management |
| Database table: `infrastructure_state` | PostgreSQL Schema | Tracks Terraform state file locations, workspace names (optional) |

### Modified Components

| Component | Changes Required |
|-----------|------------------|
| `src/lib/provisioning/index.ts` | Replace `simulateProvisioning()` call with `triggerProvisioningWorkflow()` |
| `src/lib/provisioning/simulator.ts` | Delete or comment out (replaced by real provisioning) |
| `src/lib/db/schema.ts` | Add optional `infrastructure_state` table (or expand `agent_instances` metadata) |
| `src/components/dashboard/provisioning-status.tsx` | No changes needed (already polls API correctly) |
| `src/app/api/agents/[id]/provision/route.ts` | Update to call `triggerProvisioningWorkflow()` instead of simulator |

### Integration Points to Wire Up

```
1. API Route Trigger:
   POST /api/agents/{id}/provision
   → src/lib/provisioning/index.ts::queueAgentProvisioning()
   → src/lib/provisioning/github-actions.ts::triggerProvisioningWorkflow()
   → GitHub API: repository_dispatch event

2. Workflow Execution:
   GitHub Actions: provision-agent.yml
   → Terraform: Create VM
   → Ansible: Configure VM
   → Callback: POST /api/provisioning/webhook

3. Status Update:
   POST /api/provisioning/webhook (from GitHub Actions)
   → src/lib/provisioning/index.ts::updateInstanceStatus()
   → Database: UPDATE agent_instances

4. Status Polling:
   GET /api/agents/{id}/instance (from frontend)
   → src/lib/provisioning/index.ts::getProvisioningStatus()
   → Database: SELECT from agent_instances
   → Frontend: Update UI
```

## Build Order Recommendation

Build in dependency order to enable incremental testing:

### Phase 1: Foundation (Week 1)
1. **Terraform Module:** Build `infrastructure/terraform/modules/hetzner-agent-vm/` with basic VM provisioning. Test locally with `terraform apply`.
2. **S3/R2 Backend:** Configure remote state backend. Test workspace isolation.
3. **Database Schema:** Add any missing fields to `agent_instances` table (or create `infrastructure_state` table).

### Phase 2: GitHub Actions Integration (Week 1-2)
4. **GitHub Actions Workflow:** Create `provision-agent.yml` that runs Terraform. Test with manual `workflow_dispatch` trigger.
5. **Webhook Callback:** Build `/api/provisioning/webhook/route.ts` to receive status updates. Test with curl.
6. **API Trigger:** Build `github-actions.ts` client to trigger workflows via `repository_dispatch`. Wire up to existing `/api/agents/[id]/provision` route.

### Phase 3: Configuration (Week 2)
7. **Ansible Playbook:** Create `setup-agent.yml` to configure VM (install Docker, Node.js, agent runtime).
8. **Add Ansible to Workflow:** Extend workflow to run Ansible after Terraform. Test end-to-end provisioning.
9. **Dynamic Inventory:** Build `dynamic_inventory.py` to query database for Ansible targeting.

### Phase 4: Networking (Week 2-3)
10. **Tailscale Integration:** Add Tailscale to Ansible playbook. Create Tailscale API client for device management.
11. **Update Workflow:** Add Tailscale device registration step. Callback with Tailscale IP.

### Phase 5: Termination (Week 3)
12. **Termination Workflow:** Create `terminate-agent.yml` to destroy VM and cleanup.
13. **Wire Termination API:** Update DELETE `/api/agents/[id]/instance` to trigger termination workflow.

### Phase 6: Testing & Polish (Week 3-4)
14. **Error Handling:** Add retry logic, error callbacks, status reconciliation.
15. **End-to-End Testing:** Deploy multiple agents, terminate, re-deploy. Test failure scenarios.
16. **Remove Simulator:** Delete `simulator.ts` and simulator references.

### Dependencies
- Phase 2 depends on Phase 1 (need Terraform module to run in workflow)
- Phase 3 depends on Phase 2 (need VM to exist before Ansible can configure)
- Phase 4 depends on Phase 3 (Ansible installs Tailscale)
- Phase 5 can be built in parallel with Phase 4

## Alternative Considered: Terraform Cloud API

**What:** Use Terraform Cloud's API-driven workflow instead of GitHub Actions. API routes trigger Terraform runs via REST API. Terraform Cloud manages state, execution, logs.

**Why not chosen for initial implementation:**
- Adds another paid service dependency (free tier: 500 resources/month, likely sufficient but introduces vendor lock-in)
- GitHub Actions already available, provides flexible workflow orchestration beyond just Terraform
- Terraform Cloud API requires more complex setup (workspaces, VCS connection, API tokens)
- Can migrate later if GitHub Actions becomes bottleneck

**When to reconsider:**
- Scaling beyond 200 agents (Terraform Cloud provides better state management, RBAC, cost estimation)
- Need policy-as-code (Sentinel policies in Terraform Cloud)
- Want Terraform Cloud UI for infrastructure visualization

## Sources

### Infrastructure Orchestration
- [Terraform with GitHub Actions: How to Manage & Scale](https://spacelift.io/blog/github-actions-terraform)
- [Automate Terraform with GitHub Actions | HashiCorp Developer](https://developer.hashicorp.com/terraform/tutorials/automation/github-actions)
- [Ansible with GitHub Actions: Automating Playbook Runs](https://spacelift.io/blog/github-actions-ansible)
- [Create an API-driven resource orchestration framework using GitHub Actions - AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/create-an-api-driven-resource-orchestration-framework-using-github-actions-and-terragrunt.html)

### Terraform State Management
- [How to Manage Terraform S3 Backend - Best Practices](https://spacelift.io/blog/terraform-s3-backend)
- [Backend Type: s3 | Terraform | HashiCorp Developer](https://developer.hashicorp.com/terraform/language/backend/s3)
- [Terraform State Management: Remote State and Locking](https://dasroot.net/posts/2026/02/terraform-state-management-remote-state-locking/)
- [How to Configure Terraform Backend with State Locking for Team Collaboration](https://oneuptime.com/blog/post/2026-02-09-terraform-backend-state-locking/view)

### Hetzner Cloud API
- [Hetzner API overview](https://docs.hetzner.cloud/)
- [GitHub - dennisbruner/hcloud-js: A Node.js module for the Hetzner Cloud API](https://github.com/dennisbruner/hcloud-js)
- [Hetzner Cloud API Reference](https://docs.hetzner.cloud/reference/cloud)

### Tailscale API
- [API Documentation · Tailscale](https://tailscale.com/api)
- [How to Manage Tailscale Resources with Terraform and IaC](https://tailscale.com/learn/provision-manage-and-query-tailscale-resources-programmatically-as-code)
- [Examples-API-Scripts](https://tailscale.com/community/community-projects/examples-api-scripts)

### Ansible Dynamic Inventory
- [Working with dynamic inventory — Ansible Community Documentation](https://docs.ansible.com/projects/ansible/latest/inventory_guide/intro_dynamic_inventory.html)
- [Ansible Dynamic Inventory: Types, How to Use & Examples](https://spacelift.io/blog/ansible-dynamic-inventory)
- [How to Implement Ansible Dynamic Inventory](https://oneuptime.com/blog/post/2026-01-22-ansible-dynamic-inventory/view)

### Serverless Queue Patterns
- [AWS SQS in Practice: Reliable Messaging for Microservices and Serverless Systems (2026)](https://thelinuxcode.com/aws-sqs-in-practice-reliable-messaging-for-microservices-and-serverless-systems-2026/)
- [Serverless queues and workers — Designing Lift | by Matthieu Napoli](https://medium.com/serverless-transformation/serverless-queues-and-workers-designing-lift-d870afdba867)
- [Modern serverless job schedulers - Inngest Blog](https://www.inngest.com/blog/modern-serverless-job-scheduler)

### GitHub Actions Webhooks
- [Webhook to trigger Github Actions · community · Discussion](https://github.com/orgs/community/discussions/138466)
- [Webhook Triggers for GitHub Actions](https://blog.s1h.org/github-actions-webhook/)

### Terraform Cloud API
- [The API-driven run workflow in HCP Terraform | HashiCorp Developer](https://developer.hashicorp.com/terraform/cloud-docs/run/api)
- [/runs API reference for HCP Terraform | HashiCorp Developer](https://developer.hashicorp.com/terraform/cloud-docs/api-docs/run)
- [/workspaces API reference for HCP Terraform | HashiCorp Developer](https://developer.hashicorp.com/terraform/cloud-docs/api-docs/workspaces)

---
*Architecture research for automated agent provisioning infrastructure*
*Researched: 2026-02-13*
*Confidence: HIGH - Based on official documentation, current best practices (2026), and analysis of existing Aura codebase*
