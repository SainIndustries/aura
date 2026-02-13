# Stack Research

**Domain:** Automated Infrastructure Provisioning for AI Agent SaaS
**Researched:** 2026-02-13
**Confidence:** MEDIUM

## Recommended Stack

### Core Infrastructure SDKs

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Hetzner Cloud (REST API) | v2 API | VM provisioning and management | No mature TypeScript SDK exists; direct REST API calls via fetch/axios are more reliable than unmaintained community packages. Hetzner's official SDKs are Go and Python only. |
| Octokit | ^5.0.5 | GitHub Actions workflow triggering | Official GitHub SDK for Node.js/TypeScript. Provides typed API for `actions.createWorkflowDispatch()` to trigger CI/CD workflows programmatically. |
| Tailscale API (REST) | v2 API | Network management and device auth | No official Node.js SDK. Use REST API directly with fetch. OAuth client credentials recommended over API keys for granular access scopes. |

### Job Queue & Background Processing

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Upstash QStash | Latest | Serverless message queue | **RECOMMENDED for Vercel**. Built for serverless; no persistent connections. HTTP-based, automatic retries, DLQ. Pay-per-message pricing. |
| Inngest | Latest | Background job orchestration | Alternative to QStash. More feature-rich (step functions, retries, observability) but adds vendor dependency. Good for complex multi-step workflows. |
| Drizzle ORM (job table) | ^0.45.1 (existing) | Simple job queue in PostgreSQL | **Use for MVP**. Leverage existing Neon PostgreSQL + Drizzle setup. `FOR UPDATE SKIP LOCKED` pattern for concurrent workers. No new services needed. |

### Infrastructure as Code (IaC)

| Tool | Version | Purpose | Why Recommended |
|------|---------|---------|-----------------|
| Terraform CLI (via child_process) | 1.10+ | Declarative infrastructure provisioning | **AVOID running from Next.js API routes**. Terraform state management and long execution times (30-120s) incompatible with Vercel 60s timeout. Use GitHub Actions instead. |
| Hetzner Terraform Provider | v1.59.0+ | Hetzner Cloud resource definitions | Official provider. Use `location` not deprecated `datacenter` attribute (deprecated after July 1, 2026). |

### Configuration Management

| Tool | Version | Purpose | Why Recommended |
|------|---------|---------|-----------------|
| Ansible (via GitHub Actions) | 2.16+ | VM configuration (openclaw-ansible) | **DO NOT run from Next.js**. Execute via GitHub Actions workflow on self-hosted or cloud runners. 5-10 minute playbook execution exceeds serverless limits. |
| node-ansible | ^0.1.1 | Node.js Ansible wrapper | **ONLY if you run dedicated worker server**. Not viable on Vercel. Requires Ansible installed, SSH key management, long-running processes. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| axios | ^1.7.9 | HTTP client for Hetzner/Tailscale APIs | Use for external API calls. Native fetch is sufficient but axios provides better error handling and request/response interceptors. |
| zod | ^4.3.6 (existing) | API response validation | Already in stack. Use to validate responses from Hetzner, Tailscale, GitHub APIs before persisting to database. |
| @types/node | ^20 (existing) | Node.js TypeScript types | Already in stack. Needed for child_process if spawning processes (not recommended on Vercel). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Hetzner Cloud CLI (`hcloud`) | Local testing of Hetzner API | Install via brew/apt. Useful for prototyping API calls before implementing in TypeScript. |
| Terraform | IaC development and testing | Install locally. Define `.tf` files in `/infrastructure` directory. Run via GitHub Actions in production. |
| Ansible | Playbook development | Install via pipx (2026 recommended method). Test playbooks locally against development VMs. |
| GitHub CLI (`gh`) | Workflow testing | Test `gh workflow run` commands locally before implementing programmatic triggers. |

## Installation

```bash
# Job Queue Option 1: QStash (Serverless-native)
npm install @upstash/qstash

# Job Queue Option 2: Inngest (Feature-rich alternative)
npm install inngest

# GitHub API (Required)
npm install octokit

# HTTP Client (Optional but recommended)
npm install axios

# No additional installs needed for:
# - Drizzle ORM (already installed)
# - Zod (already installed)
# - Hetzner/Tailscale APIs (use fetch or axios)
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Direct REST API (Hetzner) | hcloud-sdk npm package | If package receives active maintenance (currently 2+ years unmaintained). Community TypeScript libraries exist but lack official support. |
| Upstash QStash | BullMQ + Redis | If running dedicated Node.js worker servers (not Vercel). BullMQ requires persistent Redis connections and worker processes. Not serverless-compatible. |
| Upstash QStash | PostgreSQL job queue (Drizzle) | **Use for MVP**. Simpler, no new services, leverages existing database. Scale to QStash when job volume > 1000/day or need retries/DLQ. |
| GitHub Actions (cloud) | Self-hosted runners on Hetzner | If CI/CD costs exceed $50/month or need specialized hardware. Hetzner VMs 7.3x cheaper but note GitHub's new $0.002/min cloud platform fee (starts March 1, 2026). |
| Octokit REST | GitHub GraphQL API | If batching multiple API calls. REST is simpler for single workflow dispatch operations. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Terraform Cloud API (Node.js SDK) | `@skorfmann/terraform-cloud` package is work-in-progress. Adds complexity of managing Terraform Cloud state and API tokens. | Execute Terraform CLI from GitHub Actions. Store state in Terraform Cloud or S3. |
| AWX/Ansible Tower API | Requires separate AWX server deployment and maintenance. Overkill for simple playbook execution. | Execute ansible-playbook CLI from GitHub Actions with stored SSH keys. |
| Running Ansible from Next.js API routes | Violates Vercel 60s timeout (Pro), 10s (Hobby). SSH connections and playbook execution take 5-10 minutes. | Trigger GitHub Actions workflow via Octokit; workflow runs Ansible. |
| Running Terraform from Next.js API routes | State locking issues, timeout violations, security risks (SSH keys in Vercel environment). | Trigger GitHub Actions workflow; workflow runs Terraform. |
| hcloud-nodejs | 7 years unmaintained (v0.1.9). No TypeScript types. | Direct Hetzner REST API or hcloud-ts (community, more recent). |
| BullMQ on Vercel | Serverless functions are stateless; BullMQ requires persistent worker process and Redis connection pooling. | QStash or PostgreSQL job queue. |

## Architecture Patterns

### Recommended Flow: Webhook → Queue → GitHub Actions

**Pattern:**
```
Stripe webhook (60s timeout)
  ↓
Enqueue job to QStash/PostgreSQL (<100ms)
  ↓
Return 200 OK to Stripe
  ↓
QStash/Worker processes job
  ↓
Trigger GitHub Actions workflow via Octokit
  ↓
GitHub Actions runs:
  - Terraform (provision Hetzner VM)
  - Ansible (configure with openclaw-ansible)
  - Tailscale (join network)
  - Update job status in database
```

**Why:**
- Stripe webhooks timeout after 30s; must respond quickly
- Vercel functions timeout after 60s (Pro) or 10s (Hobby)
- Terraform + Ansible take 5-15 minutes combined
- GitHub Actions has 6-hour timeout, perfect for infrastructure provisioning
- Job queue ensures no lost provisioning requests if external service is down

### Alternative Pattern: Direct GitHub Actions Trigger (Not Recommended)

**Pattern:**
```
Stripe webhook
  ↓
Octokit.actions.createWorkflowDispatch() (<1s)
  ↓
Return 200 OK
```

**Why NOT recommended:**
- No retry logic if GitHub API is down
- No job status tracking (must poll GitHub API)
- Harder to implement idempotency
- Can't batch multiple operations
- No visibility into queue depth

### PostgreSQL Job Queue Pattern (MVP Recommendation)

**Schema:**
```typescript
// drizzle schema addition
export const provisioningJobs = pgTable('provisioning_jobs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  subscriptionId: text('subscription_id').references(() => subscriptions.id),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'failed'] })
    .notNull()
    .default('pending'),
  jobType: text('job_type', { enum: ['provision', 'deprovision', 'restart'] }).notNull(),
  payload: jsonb('payload').notNull(), // VM specs, region, etc.
  githubWorkflowRunId: text('github_workflow_run_id'), // Track GH Actions run
  error: text('error'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Index for worker polling
CREATE INDEX idx_provisioning_jobs_status ON provisioning_jobs(status, created_at)
WHERE status IN ('pending', 'in_progress');
```

**Worker (separate Vercel Cron or GitHub Actions):**
```typescript
// Runs every 1-5 minutes via Vercel Cron
const job = await db.transaction(async (tx) => {
  const [job] = await tx
    .select()
    .from(provisioningJobs)
    .where(eq(provisioningJobs.status, 'pending'))
    .orderBy(provisioningJobs.createdAt)
    .limit(1)
    .for('update', { skipLocked: true });

  if (job) {
    await tx.update(provisioningJobs)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(eq(provisioningJobs.id, job.id));
  }

  return job;
});

if (job) {
  // Trigger GitHub Actions
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const result = await octokit.actions.createWorkflowDispatch({
    owner: 'your-org',
    repo: 'infrastructure',
    workflow_id: 'provision.yml',
    ref: 'main',
    inputs: {
      jobId: job.id.toString(),
      userId: job.userId,
      payload: JSON.stringify(job.payload),
    },
  });
}
```

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 16.1.6 | Octokit ^5.0.5 | Tested. Use in API routes or server actions. |
| Vercel (deployment) | QStash | Native integration available. Automatic retries and DLQ. |
| Drizzle ORM 0.45.1 | Neon PostgreSQL (existing) | `FOR UPDATE SKIP LOCKED` supported. Use for job queue pattern. |
| GitHub Actions | Hetzner self-hosted runners | New $0.002/min cloud platform fee starts March 1, 2026 for private repos. Hetzner VMs 7.3x cheaper for high CI/CD usage. |
| Terraform 1.10+ | Hetzner Provider v1.59.0 | Use `location` attribute. `datacenter` deprecated after July 2026. |

## Confidence Assessment

| Area | Level | Reason |
|------|------|--------|
| Hetzner API | MEDIUM | No official TypeScript SDK. REST API is stable but requires manual typing. Community packages unmaintained. |
| Octokit | HIGH | Official GitHub SDK. Well-documented. Active maintenance. |
| Tailscale API | MEDIUM | No official Node.js SDK. REST API documented but manual implementation required. OAuth credentials recommended. |
| Job Queue (QStash) | HIGH | Purpose-built for Vercel serverless. Multiple sources confirm serverless compatibility. |
| Job Queue (PostgreSQL) | HIGH | Well-documented pattern. `FOR UPDATE SKIP LOCKED` is PostgreSQL standard for job queues. |
| Terraform + Ansible | HIGH | Standard tools. Not recommended in serverless but GitHub Actions integration is well-established. |
| GitHub Actions Pricing | HIGH | Official announcement of March 1, 2026 pricing change. Verified from multiple sources. |

## Sources

### Hetzner Cloud
- [Hetzner Cloud API overview](https://docs.hetzner.cloud/) — Official API documentation
- [GitHub: hetznercloud/awesome-hcloud](https://github.com/hetznercloud/awesome-hcloud) — Community libraries (MEDIUM confidence: unmaintained packages)
- [npm: hcloud-nodejs search results](https://www.npmjs.com/search?q=keywords:hetzner) — Package versions (LOW confidence: 7 years old)

### GitHub Actions & Octokit
- [GitHub: octokit/octokit.js](https://github.com/octokit/octokit.js/) — Official SDK repository
- [npm: octokit package](https://www.npmjs.com/package/octokit) — v5.0.5 published 3 months ago (HIGH confidence)
- [GitHub Docs: REST API endpoints for workflows](https://docs.github.com/en/rest/actions/workflows) — Workflow dispatch API (HIGH confidence)
- [GitHub Community Discussion #182089](https://github.com/orgs/community/discussions/182089) — March 1, 2026 pricing announcement (HIGH confidence)

### Tailscale
- [Tailscale API Documentation](https://tailscale.com/api) — Official REST API (HIGH confidence)
- [npm: @pulumi/tailscale](https://www.npmjs.com/package/@pulumi/tailscale) — v0.26.0 published Feb 12, 2026 (MEDIUM confidence: Pulumi wrapper, not direct SDK)

### Job Queues
- [Upstash Documentation: QStash Compare](https://upstash.com/docs/qstash/overall/compare) — QStash vs alternatives (HIGH confidence)
- [Inngest Blog: Long-running background functions on Vercel](https://www.inngest.com/blog/vercel-long-running-background-functions) — Serverless background jobs (HIGH confidence)
- [BullMQ.io](https://bullmq.io/) — BullMQ documentation (HIGH confidence)
- [Nico's Blog: Running Long Jobs with Queues in Next.js using Bull and Redis](https://www.nico.fyi/blog/long-running-jobs-nextjs-redis-bull) — Next.js queue pattern (MEDIUM confidence)
- [Medium: Implementing Efficient Queue Systems in PostgreSQL](https://medium.com/@epam.macys/implementing-efficient-queue-systems-in-postgresql-c219ccd56327) — PostgreSQL queue design (MEDIUM confidence)

### Vercel Limits
- [Vercel Docs: Functions Limitations](https://vercel.com/docs/functions/limitations) — Timeout limits (HIGH confidence)
- [Vercel Docs: Limits](https://vercel.com/docs/limits) — Pro tier 60s, Hobby 10s (HIGH confidence)

### Terraform
- [Terraform Registry: Hetzner Provider](https://registry.terraform.io/providers/hetznercloud/hcloud/latest) — v1.59.0 (HIGH confidence)
- [GitHub: hetznercloud/terraform-provider-hcloud releases](https://github.com/hetznercloud/terraform-provider-hcloud/releases) — Release notes (HIGH confidence)
- [David Hamann Blog: Using the Hetzner Cloud Terraform Provider](https://davidhamann.de/2026/01/21/hetzner-cloud-terraform/) — Jan 21, 2026 tutorial (MEDIUM confidence)

### Ansible
- [Ansible Docs: npm module](https://docs.ansible.com/ansible/latest/collections/community/general/npm_module.html) — Official docs (HIGH confidence)
- [GitHub: shaharke/node-ansible](https://github.com/shaharke/node-ansible) — Node.js wrapper (MEDIUM confidence)
- [DevToolbox Blog: Ansible Complete Guide for 2026](https://devtoolbox.dedyn.io/blog/ansible-complete-guide) — Best practices (MEDIUM confidence)

### Self-Hosted Runners
- [GitHub Marketplace: Self-Hosted GitHub Actions Runner on Hetzner Cloud](https://github.com/marketplace/actions/self-hosted-github-actions-runner-on-hetzner-cloud) — Community action (MEDIUM confidence)
- [Altinity Blog: Slash CI/CD Bills Part 2](https://altinity.com/blog/slash-ci-cd-bills-part-2-using-hetzner-cloud-github-runners-for-your-repository) — Cost comparison (MEDIUM confidence)
- [RunsOn Benchmarks](https://runs-on.com/benchmarks/github-actions-cpu-performance/) — Performance data (MEDIUM confidence)

---
*Stack research for: Automated Infrastructure Provisioning (Hetzner, Terraform, Ansible, Tailscale, GitHub Actions)*
*Researched: 2026-02-13*
