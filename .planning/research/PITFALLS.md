# Pitfalls Research

**Domain:** Automated VM Provisioning Infrastructure for SaaS
**Researched:** 2026-02-13
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Vercel Serverless Timeout During VM Provisioning

**What goes wrong:**
Stripe webhook handler hits Vercel's execution time limit (15s default, 5min max on Pro) while waiting for VM to be created and configured. VM gets created but webhook returns error to Stripe, triggering retries that create duplicate VMs costing real money.

**Why it happens:**
VM provisioning is inherently long-running: Hetzner API (20-60s), Ansible configuration (2-5min), Tailscale enrollment (10-30s). Total pipeline exceeds serverless execution limits. Developers treat webhooks like synchronous API calls instead of async job triggers.

**How to avoid:**
- Return HTTP 200 immediately after validating webhook
- Queue provisioning job to external service (GitHub Actions, background worker, or Vercel's `waitUntil()`)
- Store job status in database with idempotency key (`event.id`)
- Implement separate status polling endpoint for frontend
- NEVER wait for Terraform/Ansible inside webhook handler

**Warning signs:**
- Webhook handler code contains `terraform apply` or `ansible-playbook` calls
- No job queue or async processing mentioned in provisioning flow
- Frontend makes direct API call expecting synchronous VM creation
- Timeout errors in Vercel logs during webhook processing

**Phase to address:**
Phase 1 (Foundation) - Architecture must be async-first from the beginning. Fixing this later requires complete refactor.

---

### Pitfall 2: Terraform State File Corruption from Concurrent Modifications

**What goes wrong:**
Two users subscribe simultaneously, triggering parallel Terraform applies. Both read same state, make changes, write back - second write overwrites first user's VM, corrupting state. Now Terraform can't destroy first VM because it's not in state.

**Why it happens:**
Terraform state defaults to local file storage with no locking. When adding infrastructure to existing SaaS, developers skip remote state setup thinking "we'll add it later." Webhooks are inherently concurrent - Stripe retries mean 2-3 requests for same event within minutes.

**How to avoid:**
- Use remote state backend with locking (S3 + DynamoDB, Terraform Cloud, or Vercel Blob)
- Configure state locking BEFORE first `terraform apply`
- Never commit state files to git
- Use separate workspace per customer: `terraform workspace new customer-${userId}`
- Implement application-level mutex for provisioning operations

**Warning signs:**
- `terraform.tfstate` in repository
- `backend {}` block missing from Terraform config
- Multiple provision requests succeed but only one VM visible
- Terraform shows drift/unknown resources
- Can't destroy resources mentioned in database

**Phase to address:**
Phase 1 (Foundation) - Must be configured before any production provisioning begins.

---

### Pitfall 3: Secrets Exposed in Terraform State Files

**What goes wrong:**
State file contains plaintext passwords, API tokens, and SSH keys. State stored in S3 without encryption or committed to git. Attacker gains access to entire infrastructure credentials from single file leak.

**Why it happens:**
Terraform stores ALL resource attributes in state, including marked-as-sensitive values. State encryption isn't default. Developers test locally with state files, accidentally commit them. S3 buckets created without encryption-at-rest enabled.

**How to avoid:**
- Enable S3 bucket encryption: `server_side_encryption_configuration`
- Use Terraform Cloud (encrypted state by default)
- Add `terraform.tfstate*` to `.gitignore` immediately
- Store secrets in Vault/Secrets Manager, reference by ID only
- Rotate all secrets if state file ever exposed
- Use GitHub Actions OIDC instead of long-lived AWS keys
- Restrict state file access: only CI/CD and admins

**Warning signs:**
- Database passwords in `resource "hcloud_server"` user_data
- API tokens as Terraform variables
- State bucket without encryption policy
- No state file access audit logs
- Secrets stored as GitHub Actions secrets (visible in runner logs)

**Phase to address:**
Phase 1 (Foundation) - Security foundation. Cannot be retrofitted safely.

---

### Pitfall 4: Ansible Localhost-to-Remote Migration Breaks openclaw-ansible

**What goes wrong:**
openclaw-ansible playbook runs perfectly on localhost but fails when executed against remote Hetzner VM. SSH connection refused, Python dependencies missing, `ansible_connection: local` hardcoded. Agent never starts.

**Why it happens:**
Playbooks designed for `hosts: localhost` make different assumptions: local filesystem access, pre-installed Python packages, no SSH setup. Remote execution requires: SSH key distribution, known_hosts management, remote Python interpreter, `become` privilege escalation.

**How to avoid:**
- Change `hosts: localhost` → `hosts: all` in playbook
- Remove `ansible_connection: local`, use default SSH
- Add SSH key to VM via cloud-init or Terraform `hcloud_ssh_key`
- Set `host_key_checking = False` in ansible.cfg (or use ssh-keyscan pre-task)
- Install Python dependencies remotely with apt/pip tasks
- Wait for cloud-init completion: check `/var/lib/cloud/instance/boot-finished`
- Test playbook against real remote VM before production integration

**Warning signs:**
- Playbook uses `delegate_to: localhost` extensively
- No SSH configuration in playbook
- Missing `gather_facts: false` with manual wait for SSH
- Ansible error: "connection refused" or "host key verification failed"
- Python module errors only on remote execution

**Phase to address:**
Phase 2 (Ansible Adaptation) - Core technical work. Must be tested thoroughly before Phase 3 integration.

---

### Pitfall 5: Hetzner API Rate Limits During Batch Provisioning

**What goes wrong:**
Multiple users subscribe during launch day. Each VM creation polls Hetzner API every 500ms to check completion. With 20 concurrent provisions, hit 3600/hour rate limit in 10 minutes. All provisioning fails with 429 errors. Support tickets flood in.

**Why it happens:**
Terraform Hetzner provider polls aggressively by default. No rate limit handling in webhook handler. Terraform runs with high parallelism (`-parallelism=10` default). Custom images increase VM creation time to 40-60min, multiplying poll requests.

**How to avoid:**
- Set `provider "hcloud" { max_retries = 10 }` in Terraform config
- Use `-parallelism=1` when applying multiple servers
- Implement exponential backoff in webhook retry logic
- Monitor API rate limit headers in responses
- Use pre-built snapshots instead of installing packages during provision
- Stagger provisioning jobs with queue rate limiting (1 VM per 2min)
- Cache Hetzner API responses when appropriate

**Warning signs:**
- 429 Too Many Requests errors in logs
- "context deadline exceeded" after 20min
- Multiple VMs provisioning simultaneously
- Creating VMs from large installation scripts vs. snapshots
- No rate limit monitoring/alerting

**Phase to address:**
Phase 3 (Integration) - Add monitoring and rate limiting before load testing.

---

### Pitfall 6: Tailscale Auth Key Expiration Breaks Future Re-Provisioning

**What goes wrong:**
Initial VM provisioning works perfectly. 90 days later, user wants to reprovision their agent. Tailscale enrollment fails because auth key expired. Manual intervention required to generate new key.

**Why it happens:**
Tailscale auth keys expire after 90 days. Developers store single key in GitHub Secrets, thinking it's permanent. No automation for key rotation. OAuth clients (which don't expire) not used.

**How to avoid:**
- Use Tailscale OAuth clients instead of auth keys
- OAuth client generates ephemeral auth keys on-demand via API
- Store OAuth client ID/secret in GitHub Secrets (these don't expire)
- Generate new auth key for each VM provisioning via POST to `/api/v2/tailnet/:tailnet/keys`
- Use ephemeral nodes for VMs (auto-cleanup when destroyed)
- Set up monitoring alert 30 days before key expiration

**Warning signs:**
- Single `TAILSCALE_AUTH_KEY` in environment secrets
- No OAuth client configured
- Auth key embedded in Terraform/Ansible config
- Manual key rotation documentation
- Node registration fails after 90 days

**Phase to address:**
Phase 2 (Ansible Adaptation) - Implement OAuth pattern before any production VMs deployed.

---

### Pitfall 7: Webhook Idempotency Missing Causes Duplicate VM Provisioning

**What goes wrong:**
Network glitch causes webhook delivery timeout. Stripe retries same event. Application creates second VM for same user. User charged twice, two VMs consuming resources. Cost spirals.

**Why it happens:**
Webhook handlers don't check for duplicate events. Stripe retries events for 3 days if endpoint doesn't return 200. Developers assume each webhook is unique. No database tracking of `event.id`.

**How to avoid:**
- Store processed `event.id` in database BEFORE starting provisioning
- Check if `event.id` already processed at webhook entry point
- Return 200 immediately for duplicate events (don't re-provision)
- Use database transactions: record event, queue job, commit atomically
- Set Stripe webhook retry limit to reasonable value (default 3 days is excessive)
- Add `idempotency_key` to all Stripe API calls made from webhook handler

**Warning signs:**
- No event ID tracking in database
- Multiple jobs queued for same customer within seconds
- Duplicate charges in Stripe dashboard
- More VMs than active subscriptions
- Webhook handler has no idempotency check

**Phase to address:**
Phase 1 (Foundation) - Critical for production reliability. Must be included in webhook handler from day 1.

---

### Pitfall 8: Cloud-Init Race Condition Breaks Ansible Execution

**What goes wrong:**
Terraform creates VM, immediately runs Ansible. SSH connects successfully but user doesn't exist yet. Ansible fails with "user not found." Cloud-init still creating users and installing SSH keys when Ansible attempts connection.

**Why it happens:**
SSH daemon starts before cloud-init finishes. Port 22 open != system ready. Ansible's `wait_for` checks port availability, not cloud-init completion. Takes 30-90s for cloud-init to finish on first boot.

**How to avoid:**
- Don't rely on SSH port check alone
- Add explicit wait for `/var/lib/cloud/instance/boot-finished` file
- Use Ansible pre-task with retries:
  ```yaml
  - name: Wait for cloud-init
    wait_for:
      path: /var/lib/cloud/instance/boot-finished
      timeout: 300
  ```
- Set `gather_facts: false` initially, gather after wait
- Use Terraform `null_resource` with sleep or cloud-init completion check
- Add retry logic: `until`, `retries: 30`, `delay: 10`

**Warning signs:**
- Ansible connection errors only on fresh VMs
- "User not found" or "Permission denied (publickey)" on first run
- Works on retry but fails initially
- `wait_for port: 22` followed immediately by tasks
- No cloud-init completion check in playbook

**Phase to address:**
Phase 2 (Ansible Adaptation) - Critical for reliable remote execution.

---

### Pitfall 9: Orphaned VMs from Failed Terraform Destroys

**What goes wrong:**
User cancels subscription. Application triggers VM deletion. Terraform destroy fails due to missing state/dependency issue. VM keeps running, billing continues. After 100 cancellations, 20 orphaned VMs costing $200/month.

**Why it happens:**
Terraform only destroys resources tracked in state. If state corrupted or manually modified, resources orphan. Protection policies prevent deletion. Dependencies (floating IPs, volumes) block VM deletion. No fallback to cloud provider API for cleanup.

**How to avoid:**
- Implement dual-deletion: Terraform destroy + direct Hetzner API call
- On destroy failure, mark VM for manual cleanup in database
- Daily cron job lists all Hetzner VMs, compares to database, alerts on orphans
- Tag VMs with customer ID and creation date
- Set up cost alerts per customer in monitoring
- Use Terraform `terraform state rm` carefully - prefer fixing state
- Enable deletion protection = false in Terraform for test environments

**Warning signs:**
- Failed destroy operations in logs
- Hetzner bill doesn't match active subscription count
- VMs exist without corresponding database records
- "Resource not found in state" errors
- No automated orphan detection

**Phase to address:**
Phase 3 (Integration) - Add reconciliation job before scale. Phase 4 handles monitoring/cleanup automation.

---

### Pitfall 10: Database Connection Exhaustion from Webhook Bursts

**What goes wrong:**
100 users subscribe during launch promotion. Each webhook handler creates database connection, queues job, holds connection open. Vercel spawns 100 serverless instances. Database connection limit (100) exceeded. All webhooks fail.

**Why it happens:**
Serverless functions are stateless and short-lived. Each invocation creates new connection. Connection pooling doesn't work cross-invocations in traditional way. Bursts create connection stampede.

**How to avoid:**
- Use connection pooler: PgBouncer, AWS RDS Proxy, or Supabase pooler
- Set function connection limit to 1: `pool: { max: 1 }`
- Use transaction mode, not session mode (shorter connection hold)
- Close connections explicitly at end of handler
- Consider Prisma Data Proxy or serverless-friendly DB (PlanetScale, Neon)
- Implement request queuing with max concurrency limit
- Monitor connection count with alerts at 80% capacity

**Warning signs:**
- "Too many connections" errors during traffic spikes
- Database connection config shows traditional pool settings (max: 10+)
- No connection pooler in infrastructure
- Webhook failures correlate with multiple simultaneous subscribers
- Database metrics show connection spikes matching function invocations

**Phase to address:**
Phase 1 (Foundation) - Database architecture must handle serverless model from start.

---

### Pitfall 11: Infrastructure Costs Spiral with No Per-Customer Limits

**What goes wrong:**
User discovers they can trigger reprovision by canceling and resubscribing. Does this 50 times testing. Each provision leaves orphaned resources. Bill goes from $500 to $5000/month. No cost alerts triggered.

**Why it happens:**
No per-customer resource limits enforced. Cleanup failures accumulate. No cost monitoring per customer. Easy to provision, hard to verify deletion. Subscription price assumes 1 VM, but system allows unlimited.

**How to avoid:**
- Enforce 1 active VM per subscription in application logic
- Check existing VM before provisioning new one
- Delete old VM before creating replacement during reprovision
- Set Hetzner spending limit alerts per project
- Track expected vs. actual cost per customer in database
- Daily reconciliation: active subscriptions vs. running VMs
- Rate limit provisioning: max 1 per hour per customer
- Add cost projection to provisioning flow: reject if would exceed target

**Warning signs:**
- Users can provision unlimited VMs
- No "max VMs per subscription" check
- Reconciliation shows VM count > active subscription count
- Cloud bill growing faster than user count
- No per-customer cost tracking
- Missing "replace existing VM" logic for reprovision

**Phase to address:**
Phase 1 (Foundation) - Cost control is critical before accepting any payments.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Local Terraform state | Faster initial setup, no cloud config | State corruption, no locking, can't destroy resources, team collaboration impossible | NEVER - affects ability to destroy $$ resources |
| Disabling SSH host key checking globally | No known_hosts management needed | Man-in-the-middle vulnerability, can't detect compromised hosts | NEVER in production - use ssh-keyscan in playbook |
| Single long-lived Tailscale auth key | Simple secret management | Key expires in 90 days, breaks production, manual rotation | Testing only - use OAuth clients in production |
| Synchronous VM provisioning in webhook | Simpler code flow | Webhook timeouts, duplicate provisions, poor UX | NEVER - fundamentally incompatible with serverless |
| Storing secrets in Terraform variables | Easy to pass values | Secrets in state files, logs, version control | MVP only if state encrypted + not committed; migrate Phase 2 |
| Manual VM cleanup on destroy failure | Saves initial dev time | Orphaned resources, runaway costs, manual ops burden | Early testing only - automate before production |
| No idempotency in webhook handler | Fewer database queries | Duplicate charges, duplicate VMs, angry customers | NEVER - Stripe retries are guaranteed |
| Traditional connection pooling config | Copy-paste from old apps | Connection exhaustion in serverless bursts | Never - must use serverless-compatible approach |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Hetzner Cloud API** | Using custom images without understanding 40-60min creation times and high API poll frequency hitting rate limits | Use pre-built snapshots with installed packages; set `max_retries = 10`; use `-parallelism=1` |
| **Stripe Webhooks** | Returning 200 only after completing provisioning workflow | Return 200 immediately after validation; queue job; poll status separately |
| **Tailscale API** | Storing auth keys as long-lived secrets in GitHub Actions | Use OAuth clients to generate ephemeral keys per-provisioning via API |
| **GitHub Actions Secrets** | Storing AWS keys directly | Use OIDC for federated auth; use secrets manager for runtime secrets |
| **Terraform Hetzner Provider** | Running applies concurrently without state locking | Configure remote state backend with locking before first apply |
| **Ansible SSH** | Assuming SSH ready when port 22 open | Wait for `/var/lib/cloud/instance/boot-finished`; retry connection with delays |
| **Vercel Serverless Functions** | Attempting long-running operations inside function | Use `waitUntil()` for background work or external job queue |
| **Database Connections** | Traditional pool config (max: 10-20) | Set max: 1 per function; use connection pooler (PgBouncer/RDS Proxy) |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Polling Terraform/Ansible status in webhook | Timeouts, 429 errors, webhook failures | Return 200 immediately; poll separately from frontend | >5 concurrent provisions |
| No Hetzner API rate limit handling | Random "context deadline exceeded" errors | Monitor rate limit headers; exponential backoff; queue with delays | >10 VMs/hour |
| Single Terraform workspace for all customers | State locking blocks all provisions; state conflicts | Separate workspace per customer | >5 customers |
| SSH connection retries without backoff | Cloud-init race conditions, connection failures | Wait for boot-finished file; retry with exponential backoff | First connection to any new VM |
| No connection pooler with serverless | DB connection errors during traffic spikes | PgBouncer or RDS Proxy; max: 1 per function | >10 concurrent webhooks |
| Manual orphan VM detection | Unnoticed cost increases over weeks | Automated daily reconciliation; cost per customer tracking | >50 total VMs provisioned |
| Creating VMs from large cloud-init scripts | 40-60min provision times, frequent API timeouts | Pre-built snapshots with packages installed | >100MB of packages to install |
| Synchronous GitHub Actions workflow | Webhook timeouts waiting for 5min workflow | Webhook triggers workflow; frontend polls job status | Any production use |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Terraform state without encryption** | Credentials leaked via S3 breach or git commit | S3 bucket encryption mandatory; `terraform.tfstate*` in `.gitignore`; use Terraform Cloud |
| **Long-lived AWS keys in GitHub Secrets** | Keys leaked in logs, compromised if repo accessed | GitHub Actions OIDC for AWS auth; rotate keys monthly; use scoped IAM roles |
| **Hardcoded Tailscale auth keys** | Keys in git history, expired keys break production | OAuth clients generate ephemeral keys; store client ID/secret only |
| **Ansible `host_key_checking = false` globally** | Man-in-the-middle attacks on SSH connections | Use ssh-keyscan in pre-task; disable only in ansible.cfg for specific inventory |
| **No webhook signature verification** | Attackers trigger VM provisioning without payment | Verify `stripe-signature` header; reject invalid signatures |
| **Database credentials in user_data** | Credentials visible in Hetzner console, Terraform state | Use Vault or AWS Secrets Manager; inject via Ansible after VM creation |
| **No VM firewall rules** | VMs exposed to internet; attack surface | Configure Hetzner firewall; allow only Tailscale network + SSH from bastion |
| **SSH keys not rotated** | Compromised keys grant permanent access | Generate new SSH key per provision; automate rotation every 90 days |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **No provisioning status updates** | User waits 5 minutes staring at spinner, uncertain if working | Real-time status: "Creating VM... Configuring agent... Joining network... Ready!" |
| **Provision failure shows technical error** | "Terraform error: exit code 1" confuses users | User-friendly: "Setup failed. We're investigating. You haven't been charged." |
| **No estimated time for provisioning** | User doesn't know if 5min wait is normal or stuck | Show estimate: "Usually takes 3-5 minutes" with progress bar |
| **Can't cancel during provisioning** | User stuck waiting, no control | Allow cancellation; cleanup resources; don't charge |
| **Reprovision destroys user data without warning** | Agent config/data lost unexpectedly | Warn: "This will delete your agent data. Download backup first." |
| **No retry button after failure** | User must cancel subscription and resubscribe to retry | "Try Again" button reruns provisioning without new charge |
| **Subscription active but VM not running** | User paid but can't use service, no visibility | Auto-retry provision 3 times; auto-refund if all fail; clear status shown |
| **No cost estimate before provision** | Bill shock when charged for VMs | Show: "Your plan includes 1 agent. Estimated cost: $X/month" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Terraform configured:** Remote state backend with locking enabled and tested with concurrent applies
- [ ] **Webhook handler:** Idempotency check (`event.id` tracked in DB) before any provisioning logic
- [ ] **Webhook response:** Returns 200 within 1 second; provisioning happens async
- [ ] **Ansible playbook:** Tested against remote VM (not just localhost); waits for cloud-init completion
- [ ] **Tailscale enrollment:** Uses OAuth client for ephemeral key generation (not hardcoded key)
- [ ] **SSH configuration:** Known_hosts managed via ssh-keyscan or disabled only for specific inventory
- [ ] **Database connections:** Serverless-compatible pooling (max: 1 + external pooler)
- [ ] **Cost tracking:** Per-customer VM count limits enforced; reconciliation job detects orphans
- [ ] **Error handling:** Failed provisions don't leave orphaned VMs; cleanup automated
- [ ] **Rate limiting:** Hetzner API rate limits handled; max concurrent provisions enforced
- [ ] **Secret management:** No secrets in Terraform state/code; Vault or Secrets Manager used
- [ ] **Monitoring:** Alerts for: orphaned VMs, cost anomalies, provision failures, webhook errors
- [ ] **Testing:** Tested with concurrent provisions, webhook retries, and provision failures
- [ ] **Documentation:** Runbook for manual VM cleanup, state recovery, and cost reconciliation

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **Corrupted Terraform state** | HIGH | 1. Backup state file 2. `terraform import` each resource 3. Verify with `plan` 4. Future: use remote state with locking |
| **Duplicate VMs from webhook retries** | MEDIUM | 1. Identify duplicates via Hetzner console 2. `terraform import` or direct API delete 3. Refund customer 4. Add idempotency check |
| **Expired Tailscale auth key** | LOW | 1. Generate new OAuth client 2. Update secrets 3. Reprovision failed VMs 4. Configure OAuth for future provisions |
| **Orphaned VMs** | MEDIUM | 1. List all Hetzner VMs 2. Compare to database 3. Identify owners by tags 4. Delete via API 5. Update database 6. Implement reconciliation job |
| **Database connection exhaustion** | LOW | 1. Restart DB connections 2. Add connection pooler 3. Update function config to max: 1 4. Deploy and monitor |
| **SSH known_hosts failure** | LOW | 1. Clear known_hosts 2. Add ssh-keyscan pre-task to playbook 3. Retry provisioning |
| **Cloud-init race condition** | LOW | 1. Retry Ansible after 60s 2. Add boot-finished wait to playbook 3. Redeploy |
| **Hit API rate limit** | MEDIUM | 1. Wait 60min for limit reset 2. Add rate limit monitoring 3. Reduce parallelism 4. Stagger provisions with queue |
| **Secrets leaked in state** | HIGH | 1. Rotate ALL secrets immediately 2. Audit access logs 3. Enable state encryption 4. Remove state from git history 5. Implement proper secret management |
| **Cost spiral from unlimited provisions** | HIGH | 1. Immediately pause provisioning 2. Audit all running VMs 3. Delete unauthorized VMs 4. Implement per-customer limits 5. Set spending alerts |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Vercel serverless timeout | Phase 1: Foundation | Webhook returns 200 in <1s; provision happens async |
| Terraform state corruption | Phase 1: Foundation | Remote state configured; concurrent applies don't conflict |
| Secrets in state | Phase 1: Foundation | State encrypted; secrets in Vault; no credentials in `.tf` files |
| Database connection exhaustion | Phase 1: Foundation | Connection pooler configured; max: 1 per function; spike test passes |
| Webhook idempotency | Phase 1: Foundation | Duplicate webhook creates 200 response but no duplicate VM |
| Localhost-to-remote Ansible | Phase 2: Ansible Adaptation | Playbook runs successfully against remote Hetzner VM |
| Cloud-init race condition | Phase 2: Ansible Adaptation | 100% success rate on fresh VMs; no connection failures |
| Tailscale key expiration | Phase 2: Ansible Adaptation | OAuth client generates keys; enrollment works in testing |
| SSH known_hosts issues | Phase 2: Ansible Adaptation | Playbook handles first connection automatically |
| Hetzner API rate limits | Phase 3: Integration | Rate limit headers monitored; backoff implemented; 10 concurrent provisions succeed |
| Orphaned VMs | Phase 3: Integration | Reconciliation job detects orphans within 24h; alerts triggered |
| Cost spiral from unlimited provisions | Phase 3: Integration | Per-customer limits enforced; provisions rejected if VM exists |
| No provisioning status | Phase 4: Production Hardening | Real-time status updates shown; ETA displayed; failures user-friendly |

---

## Sources

### Terraform State Management
- [Managing Terraform State - Best Practices & Examples](https://spacelift.io/blog/terraform-state)
- [Terraform State Management: Remote State and Locking](https://dasroot.net/posts/2026/02/terraform-state-management-remote-state-locking/)
- [Avoiding Terraform State Management Pitfalls](https://medium.com/@mohamed.mourad/avoiding-terraform-state-management-pitfalls-2d6b94bd2ff0)

### Hetzner Cloud API
- [Hetzner API Changelog](https://docs.hetzner.cloud/changelog)
- [Hetzner Cloud API Documentation](https://docs.hetzner.cloud/)
- [Terraform Hetzner Provider Rate Limits Issue #601](https://github.com/hetznercloud/terraform-provider-hcloud/issues/601)
- [Hetzner API Rate Limits Discussion #1401](https://github.com/mysticaltech/terraform-hcloud-kube-hetzner/discussions/1401)

### Ansible Remote Execution
- [How to resolve 'hosts: localhost' issue in Ansible](https://labex.io/tutorials/ansible-how-to-resolve-hosts-localhost-issue-in-ansible-415692)
- [Controlling where tasks run: delegation and local actions](https://docs.ansible.com/projects/ansible/latest/playbook_guide/playbooks_delegation.html)
- [Ansible SSH Known Host Keys](https://everythingshouldbevirtual.com/automation/ansible-ssh-known-host-keys/)

### Tailscale Automation
- [How I Built a Tailscale Auth Key Rotator](https://medium.com/@brent.gruber77/how-i-built-a-tailscale-auth-key-rotator-814722b839e0)
- [Tailscale OAuth Clients Documentation](https://tailscale.com/kb/1215/oauth-clients)
- [FR: Auto-Renewal for Headless Node Keys Issue #16566](https://github.com/tailscale/tailscale/issues/16566)

### Vercel Serverless Limits
- [What can I do about Vercel Functions timing out?](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Configuring Maximum Duration for Vercel Functions](https://vercel.com/docs/functions/configuring-functions/duration)

### Stripe Webhook Reliability
- [Handling Payment Webhooks Reliably (Idempotency, Retries, Validation)](https://medium.com/@sohail_saifii/handling-payment-webhooks-reliably-idempotency-retries-validation-69b762720bf5)
- [Stripe Idempotent Requests API Reference](https://docs.stripe.com/api/idempotent_requests)
- [Idempotent Stripe Webhooks – Other Things](https://blog.adamzolo.com/idempotent-stripe-webhooks/)

### Infrastructure Cost Control
- [11 cloud cost optimization strategies and best practices for 2026](https://northflank.com/blog/cloud-cost-optimization)
- [Cloud Cost Optimization Strategies for 2026](https://stratus10.com/blog/cloud-cost-optimization-strategies-2026)
- [Top 12 Cloud Cost Optimization Strategies for 2026](https://www.cloudkeeper.com/insights/blog/top-12-cloud-cost-optimization-strategies-2026)

### VM Provisioning & Recovery
- [Terraform Provisioners: Usage, Limitations, and Practical Alternatives](https://wintelguy.com/2026/terraform-provisioners-usage-limitations-and-practical-alternatives.html)
- [Disaster recovery strategies with Terraform](https://www.hashicorp.com/en/blog/disaster-recovery-strategies-with-terraform)
- [Why Destroying Terraform Resources Is So Hard](https://ubos.tech/news/why-destroying-terraform-resources-is-so-hard-a-deep-dive/)

### GitHub Actions Security
- [Terraform Actions with Ansible Automation Platform and Vault SSH](https://medium.com/@glennchia7/terraform-actions-with-ansible-automation-platform-and-vault-ssh-for-vm-configuration-f7514a7c23af)
- [How to Handle Secrets in Configuration Management Tools](https://blog.gitguardian.com/how-to-handle-secrets-configuration-management-tools/)

### Database & Serverless
- [Connection Pooling with Vercel Functions](https://vercel.com/guides/connection-pooling-with-serverless-functions)
- [Serverless Function Best Practices - CockroachDB](https://www.cockroachlabs.com/docs/stable/serverless-function-best-practices)
- [How To: Reuse Database Connections in AWS Lambda](https://www.jeremydaly.com/reuse-database-connections-aws-lambda/)

### Cloud-Init & SSH
- [EC2 slow cloud-init, Ansible SSH connection fails due to race condition](https://forum.ansible.com/t/ec2-slow-cloud-init-ansible-ssh-connection-fails-due-to-race-condition-wait-for-is-not-good-enough/20345)
- [Connection methods and details - Ansible Documentation](https://docs.ansible.com/projects/ansible/latest/inventory_guide/connection_details.html)

### Monitoring & Observability
- [11 Key Observability Best Practices You Should Know in 2026](https://spacelift.io/blog/observability-best-practices)
- [DevOps Monitoring and Observability 2026 - Practical Guide](https://vettedoutsource.com/blog/devops-monitoring-observability/)

---

*Pitfalls research for: Automated VM Provisioning Infrastructure for Aura SaaS*
*Researched: 2026-02-13*
*Confidence: HIGH - Based on official documentation, production post-mortems, and 2026 best practices*
