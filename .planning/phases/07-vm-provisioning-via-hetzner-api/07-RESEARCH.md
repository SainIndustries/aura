# Phase 07: VM Provisioning via Hetzner API - Research

**Researched:** 2026-02-13
**Domain:** Cloud VM provisioning, Hetzner Cloud REST API, Tailscale networking
**Confidence:** MEDIUM-HIGH

## Summary

This phase implements automated VM provisioning on Hetzner Cloud using direct REST API calls (no SDK, no Terraform), with automatic Tailscale network enrollment using OAuth-generated ephemeral auth keys. The workflow runs entirely in GitHub Actions (15-minute timeout) and completes full provisioning (payment to running VM with Tailscale connectivity) in under 5 minutes.

**Key Technical Stack:**
- **Hetzner Cloud REST API** (v1) - Direct HTTPS/JSON API, 3600 req/hour rate limit, 15-30 second provisioning time
- **Tailscale OAuth Client** - Generate ephemeral auth keys via API (no static keys)
- **cloud-init** - Automated VM initialization with Tailscale installation and enrollment
- **GitHub Actions** - Workflow execution environment with secrets management

**Primary recommendation:** Use Hetzner's cloud-init `user_data` parameter with `runcmd` to install and configure Tailscale during first boot. Poll Hetzner's Actions API to verify server readiness, then verify Tailscale enrollment via Tailscale API device listing.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hetzner Cloud API | v1 | VM creation/management | Direct REST API, official Hetzner interface, no dependencies |
| Tailscale API | v2 | Auth key generation, device verification | Official OAuth client pattern for automation |
| cloud-init | (built-in) | VM initialization automation | Industry standard, native Hetzner support, declarative YAML |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| curl | (built-in) | Tailscale installation script | Recommended by Tailscale official docs |
| GitHub Actions secrets | (built-in) | Secure credential storage | Required for API tokens (Hetzner, Tailscale OAuth) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct REST API | Hetzner Python/Go SDK | User locked in SDK but added dependency; direct API gives full control |
| Direct REST API | Terraform | User explicitly rejected Terraform in v1.1 initialization; database is source of truth |
| cloud-init user_data | SSH post-creation | Race conditions, complexity, requires SSH key management, slower |
| Ephemeral auth keys | Static auth keys | Security risk (keys don't expire), manual rotation required |

**Installation:**
No npm packages required. Uses native HTTP fetch in Node.js/GitHub Actions for API calls.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── hetzner.ts         # Hetzner Cloud API client functions
│   ├── tailscale.ts       # Tailscale API client functions
│   └── cloud-init.ts      # Cloud-init configuration generation
└── types/
    └── provisioning.ts    # VM provisioning types
.github/
└── workflows/
    └── provision-agent.yml # GitHub Actions workflow (already exists)
```

### Pattern 1: Hetzner Server Creation with cloud-init
**What:** POST to `/v1/servers` with `user_data` containing cloud-init YAML
**When to use:** Every VM provisioning request
**Example:**
```typescript
// Source: https://docs.hetzner.cloud/reference/cloud
const createServer = async (config: {
  name: string;
  serverType: string;
  image: string;
  location: string;
  sshKeys: number[];
  userData: string;
}) => {
  const response = await fetch('https://api.hetzner.cloud/v1/servers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: config.name,
      server_type: config.serverType,
      image: config.image,
      location: config.location,
      ssh_keys: config.sshKeys,
      user_data: config.userData,
      start_after_create: true,
    }),
  });

  const data = await response.json();
  // Response includes: server.id, server.public_net.ipv4.ip, action.id
  return data;
};
```

### Pattern 2: Tailscale OAuth Client for Ephemeral Auth Keys
**What:** Use OAuth client secret directly with Tailscale up, or generate auth key via API
**When to use:** Every VM provisioning to create unique, ephemeral auth key
**Example:**
```typescript
// Source: https://tailscale.com/kb/1215/oauth-clients
// Option 1: Direct OAuth secret usage (simplest)
const authKey = `${process.env.TAILSCALE_OAUTH_CLIENT_SECRET}?ephemeral=true&preauthorized=true`;

// Option 2: Generate auth key via API (more control)
const createAuthKey = async () => {
  // First, get OAuth access token
  const tokenResponse = await fetch('https://api.tailscale.com/api/v2/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.TAILSCALE_OAUTH_CLIENT_ID!,
      client_secret: process.env.TAILSCALE_OAUTH_CLIENT_SECRET!,
    }),
  });
  const { access_token } = await tokenResponse.json();

  // Then, create auth key
  const keyResponse = await fetch('https://api.tailscale.com/api/v2/tailnet/-/keys', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      capabilities: {
        devices: {
          create: {
            reusable: false,
            ephemeral: true,
            preauthorized: true,
            tags: ['tag:agent'],
          },
        },
      },
      expirySeconds: 3600, // 1 hour
    }),
  });

  const { key } = await keyResponse.json();
  return key;
};
```

### Pattern 3: cloud-init Configuration for Tailscale
**What:** YAML-formatted cloud-init config with `runcmd` to install and configure Tailscale
**When to use:** Generate dynamically for each VM, pass as `user_data` parameter
**Example:**
```yaml
# Source: https://onatm.dev/2026/01/28/private-networking-on-hetzner-cloud-with-tailscale/
#cloud-config

# Install Tailscale via official installation script
runcmd:
  - curl -fsSL https://tailscale.com/install.sh | sh
  - tailscale up --auth-key=${TAILSCALE_AUTH_KEY} --advertise-tags=tag:agent --hostname=${SERVER_NAME}
```

**Implementation notes:**
- `runcmd` executes on first boot only, after network is ready
- Variables (e.g., `${TAILSCALE_AUTH_KEY}`) must be interpolated before sending to Hetzner API
- Hetzner accepts user_data as plain string (UTF-8), NOT base64-encoded (unless binary/gzipped)
- 32 KiB size limit on user_data (use gzip+base64 if needed, but simple configs fit easily)

### Pattern 4: Polling Hetzner Action Status
**What:** Poll `/v1/actions/{id}` until `status=success` to verify server ready
**When to use:** After server creation returns, before proceeding to verification
**Example:**
```typescript
// Source: https://hcloud-python.readthedocs.io/en/latest/api.clients.actions.html
const waitForAction = async (actionId: number, maxRetries = 120, intervalMs = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(`https://api.hetzner.cloud/v1/actions/${actionId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}`,
      },
    });

    const { action } = await response.json();

    if (action.status === 'success') {
      return action;
    }

    if (action.status === 'error') {
      throw new Error(`Action failed: ${action.error?.message}`);
    }

    // Status is 'running', continue polling
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Action timeout: exceeded max retries');
};

// Possible statuses: 'running', 'success', 'error'
```

### Pattern 5: Verifying Tailscale Enrollment
**What:** Poll Tailscale devices API to verify VM joined network and has Tailscale IP
**When to use:** After Hetzner action completes, before marking provisioning as complete
**Example:**
```typescript
// Source: https://tailscale.com/api (devices endpoint)
const verifyTailscaleEnrollment = async (hostname: string, maxRetries = 60, intervalMs = 2000) => {
  // Get OAuth access token first
  const tokenResponse = await fetch('https://api.tailscale.com/api/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.TAILSCALE_OAUTH_CLIENT_ID!,
      client_secret: process.env.TAILSCALE_OAUTH_CLIENT_SECRET!,
    }),
  });
  const { access_token } = await tokenResponse.json();

  // Poll devices endpoint
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch('https://api.tailscale.com/api/v2/tailnet/-/devices', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    const { devices } = await response.json();
    const device = devices.find((d: any) => d.hostname === hostname);

    if (device && device.addresses && device.addresses.length > 0) {
      return {
        tailscaleIp: device.addresses[0], // Primary Tailscale IP
        deviceId: device.id,
        lastSeen: device.lastSeen,
      };
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Tailscale enrollment timeout for ${hostname}`);
};
```

### Anti-Patterns to Avoid
- **Don't use `bootcmd` for Tailscale installation**: `bootcmd` runs on every boot before network is ready; use `runcmd` which runs once on first boot after network initialization
- **Don't poll too aggressively**: Respect Hetzner's 3600 req/hour rate limit (60 req/min); use 1-2 second intervals for action polling
- **Don't hardcode auth keys**: Always generate ephemeral keys dynamically; never reuse auth keys across VMs
- **Don't skip error handling**: Hetzner API returns detailed error objects with `code` and `message`; always check HTTP status and parse error responses
- **Don't assume immediate Tailscale enrollment**: cloud-init script execution takes 30-60 seconds after server is "running"; poll Tailscale API with retries

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSH key management | Custom key generation/storage | Hetzner SSH Keys API | Centralized management, reusable across servers, automatic injection |
| Server name uniqueness | Custom collision detection | Hetzner API error handling | API returns 409 Conflict if name exists; let API enforce uniqueness |
| Rate limit handling | Custom backoff logic | Exponential backoff with jitter | Standard pattern, respects RateLimit-Reset header, prevents thundering herd |
| cloud-init validation | Custom YAML validator | Hetzner API validation | API validates user_data; rely on error responses rather than pre-validation |
| Tailscale IP assignment | Custom IP selection | Tailscale auto-assignment | Tailscale manages IP pool automatically; querying devices API is sufficient |

**Key insight:** Hetzner and Tailscale APIs are production-grade with built-in error handling, validation, and resource management. Let the APIs do the heavy lifting rather than reimplementing their logic.

## Common Pitfalls

### Pitfall 1: cloud-init Clock Skew Causing SSL Errors
**What goes wrong:** Tailscale installation fails with "certificate not yet valid" errors because VM's system clock is wrong at boot.
**Why it happens:** VMs may boot with incorrect system time before NTP sync completes, causing SSL certificate validation to fail during `curl https://tailscale.com/install.sh`.
**How to avoid:** Force NTP sync before running Tailscale installation in cloud-init:
```yaml
#cloud-config
runcmd:
  - systemctl restart systemd-timesyncd
  - timeout 60 bash -c 'until timedatectl status | grep -q "System clock synchronized: yes"; do sleep 1; done'
  - curl -fsSL https://tailscale.com/install.sh | sh
  - tailscale up --auth-key=${AUTH_KEY} --hostname=${HOSTNAME}
```
**Warning signs:** cloud-init logs show SSL certificate errors; Tailscale not installed despite cloud-init completion.
**Confidence:** MEDIUM (based on [Elliot Blackburn blog post](https://www.elliotblackburn.com/certificate-not-yet-valid-when-installing-tailscale-via-cloud-init-on-raspberry-pi/))

### Pitfall 2: Ignoring Hetzner Action Polling
**What goes wrong:** Code assumes server is immediately ready after POST /servers returns, leading to SSH connection failures or premature verification attempts.
**Why it happens:** Hetzner server creation is asynchronous; POST response includes `action` object with `id`, but server isn't actually running until action status is "success".
**How to avoid:** Always poll `/v1/actions/{id}` until `status === 'success'` before attempting to verify or use the server.
**Warning signs:** "Connection refused" errors when attempting SSH; inconsistent provisioning success rates; race conditions in CI/CD.
**Confidence:** HIGH (verified from [Hetzner Cloud Python docs](https://hcloud-python.readthedocs.io/en/latest/api.clients.actions.html))

### Pitfall 3: Tailscale Enrollment Timing Race Condition
**What goes wrong:** Provisioning workflow marks job as complete before VM actually joins Tailscale network, resulting in unreachable VMs.
**Why it happens:** cloud-init `runcmd` executes asynchronously after server boots; "server running" ≠ "Tailscale enrolled".
**How to avoid:** After Hetzner action completes, poll Tailscale devices API (`GET /api/v2/tailnet/-/devices`) until device with matching hostname appears with assigned IP address.
**Warning signs:** Server exists in Hetzner but not in Tailscale network; database has `server_id` but no `tailscale_ip`; users can't connect to agent.
**Confidence:** HIGH (combination of [Tailscale cloud-init video](https://tailscale.com/blog/video-cloud-init-iac) and field reports)

### Pitfall 4: Hetzner Rate Limit Exhaustion
**What goes wrong:** High-volume provisioning or aggressive polling triggers HTTP 429 Too Many Requests, causing provisioning failures.
**Why it happens:** Hetzner Cloud API has 3600 requests/hour limit (60/min average); polling every 500ms exceeds this limit.
**How to avoid:**
- Use 1-2 second polling intervals (not 500ms)
- Respect `RateLimit-Remaining` header; back off if < 10% remaining
- Implement exponential backoff on 429 responses
- Use `RateLimit-Reset` header to calculate wait time
**Warning signs:** HTTP 429 responses; provisioning failures during high load; `RateLimit-Remaining: 0` in response headers.
**Confidence:** HIGH (verified from [Hetzner API docs](https://docs.hetzner.cloud/))

### Pitfall 5: Duplicate Server Name Conflicts
**What goes wrong:** Provisioning fails with "server name already in use" error, leaving database in inconsistent state.
**Why it happens:** Hetzner enforces unique server names per project; retry attempts with same name fail.
**How to avoid:**
- Use unique names with UUIDs or timestamps: `agent-${userId}-${timestamp}`
- Catch HTTP 409 Conflict errors and check if existing server belongs to same provisioning job
- If retrying failed provision, delete old server first or use a new name
**Warning signs:** HTTP 409 errors; stuck provisioning jobs; orphaned servers in Hetzner console.
**Confidence:** MEDIUM (inferred from [SSH key conflict example](https://github.com/hetznercloud/hcloud-go/issues/79))

### Pitfall 6: Ephemeral Node Cleanup Assumptions
**What goes wrong:** Assuming ephemeral nodes are deleted immediately when VM is destroyed; stale nodes linger in Tailscale admin for 30 minutes to 48 hours.
**Why it happens:** Tailscale auto-removes ephemeral nodes after "last activity," not immediately on disconnect. Timing varies (30 min to 48 hours).
**How to avoid:**
- Don't rely on automatic cleanup for billing logic or resource counts
- Optionally call `tailscale logout` via SSH before destroying VM for immediate removal
- Accept 30-48 hour cleanup delay as normal behavior
- Filter "offline" devices when querying Tailscale API
**Warning signs:** Tailscale admin shows more nodes than active VMs; confusion about active device counts.
**Confidence:** MEDIUM (based on [Tailscale ephemeral nodes blog](https://tailscale.com/blog/ephemeral-logout) and [GitHub issue #14805](https://github.com/tailscale/tailscale/issues/14805))

### Pitfall 7: user_data Size Limit and Encoding Confusion
**What goes wrong:** Large cloud-init configs fail silently; confusion about whether to base64-encode user_data.
**Why it happens:** Hetzner has 32 KiB limit on user_data; documentation mentions base64 encoding but it's only for binary/gzipped data.
**How to avoid:**
- Keep cloud-init configs simple and under 32 KiB (plain YAML is fine for typical Tailscale setup)
- If exceeding limit, use gzip + base64 encoding: `echo "$YAML" | gzip | base64`
- For plain text/YAML, send as-is (UTF-8 string); DO NOT base64-encode unless necessary
- Verify encoding by checking cloud-init logs on VM: `/var/log/cloud-init.log`
**Warning signs:** cloud-init scripts not executing; `/var/log/cloud-init.log` shows parse errors; silent failures.
**Confidence:** HIGH (verified from [Hetzner cloud-init PR #448](https://github.com/canonical/cloud-init/pull/448))

## Code Examples

Verified patterns from official sources:

### Complete cloud-init Configuration
```yaml
#cloud-config
# Source: https://onatm.dev/2026/01/28/private-networking-on-hetzner-cloud-with-tailscale/
# Combined with best practices from https://www.elliotblackburn.com/certificate-not-yet-valid-when-installing-tailscale-via-cloud-init-on-raspberry-pi/

# Ensure clock is synchronized before installing Tailscale (prevents SSL errors)
runcmd:
  - systemctl restart systemd-timesyncd
  - timeout 60 bash -c 'until timedatectl status | grep -q "System clock synchronized: yes"; do sleep 1; done'
  - curl -fsSL https://tailscale.com/install.sh | sh
  - tailscale up --auth-key=${TAILSCALE_AUTH_KEY} --advertise-tags=tag:agent --hostname=${SERVER_NAME}

# Note: Variables (${...}) must be interpolated in TypeScript before sending to Hetzner API
# Example: userData.replace('${TAILSCALE_AUTH_KEY}', authKey).replace('${SERVER_NAME}', serverName)
```

### Hetzner Server Creation API Call
```typescript
// Source: https://docs.hetzner.cloud/reference/cloud
interface CreateServerResponse {
  server: {
    id: number;
    name: string;
    status: 'initializing' | 'starting' | 'running' | 'stopping' | 'off' | 'deleting' | 'migrating' | 'rebuilding' | 'unknown';
    public_net: {
      ipv4: {
        ip: string;
        blocked: boolean;
      };
      ipv6: {
        ip: string;
        blocked: boolean;
      };
    };
    server_type: {
      id: number;
      name: string;
      cores: number;
      memory: number;
      disk: number;
    };
    datacenter: {
      id: number;
      name: string;
      location: {
        id: number;
        name: string;
        country: string;
        city: string;
      };
    };
  };
  action: {
    id: number;
    command: string;
    status: 'running' | 'success' | 'error';
    progress: number;
    started: string;
    finished: string | null;
    error: {
      code: string;
      message: string;
    } | null;
  };
  next_actions: Array<{
    id: number;
    command: string;
    status: string;
  }>;
}

const response = await fetch('https://api.hetzner.cloud/v1/servers', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: `agent-${userId}-${timestamp}`,
    server_type: 'cpx11', // 2 vCPU, 2GB RAM, €0.0063/hr
    image: 'ubuntu-22.04',
    location: 'nbg1', // Nuremberg, Germany
    ssh_keys: [sshKeyId], // SSH key ID from Hetzner
    user_data: cloudInitYaml,
    start_after_create: true,
    labels: {
      'provisioning_job_id': jobId,
      'user_id': userId,
    },
  }),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(`Hetzner API error: ${error.error.code} - ${error.error.message}`);
}

const data: CreateServerResponse = await response.json();

// Store in database
await db.query(
  `UPDATE provisioning_jobs
   SET server_id = $1, server_ip = $2, region = $3, hetzner_action_id = $4
   WHERE id = $5`,
  [data.server.id, data.server.public_net.ipv4.ip, data.server.datacenter.location.name, data.action.id, jobId]
);

// Poll action until complete
await waitForAction(data.action.id);
```

### Rate Limit Handling with Exponential Backoff
```typescript
// Source: Best practices from https://docs.hetzner.cloud/
const fetchWithRateLimit = async (url: string, options: RequestInit) => {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const resetHeader = response.headers.get('RateLimit-Reset');
      const resetTime = resetHeader ? parseInt(resetHeader) * 1000 : null;
      const now = Date.now();

      let waitTime: number;
      if (resetTime && resetTime > now) {
        // Wait until rate limit resets, plus small buffer
        waitTime = resetTime - now + 1000;
      } else {
        // Exponential backoff with jitter
        waitTime = Math.min(1000 * Math.pow(2, attempt), 60000) + Math.random() * 1000;
      }

      console.log(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      attempt++;
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded due to rate limiting');
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static Tailscale auth keys | OAuth client with ephemeral keys | 2023 | Better security (auto-expiring), no manual rotation, scoped permissions |
| Base64-encoded user_data by default | Plain text user_data, base64 only for binary | 2021 (PR #448) | Simpler configs, less encoding overhead, easier debugging |
| Datacenter property | Location property | Deprecation announced 2026 | Use `location` instead of `datacenter` in server creation (datacenter removed after July 1, 2026) |
| Manual SSH key injection | Hetzner SSH Keys API | Always available | Centralized key management, automatic injection, reusable across projects |

**Deprecated/outdated:**
- **Datacenter property**: Deprecated in favor of `location` property for servers and primary IPs ([Hetzner changelog 2026](https://docs.hetzner.cloud/changelog)). Will be removed after July 1, 2026.
- **Static Tailscale API keys**: Replaced by OAuth clients for automation use cases. Static keys still work but require manual rotation and lack scoped permissions.

## Open Questions

1. **What's the best error recovery strategy for partial failures?**
   - What we know: Hetzner server created, but Tailscale enrollment fails → orphaned VM
   - What's unclear: Should we delete the Hetzner server immediately, or retry Tailscale enrollment?
   - Recommendation: Implement retry logic for Tailscale enrollment (3 attempts, 30-second intervals). If all retries fail, mark job as failed but keep server running for debugging. Add manual cleanup endpoint.

2. **How to handle SSH key management for initial access?**
   - What we know: Hetzner SSH Keys API allows uploading public keys; required for server access
   - What's unclear: Should we generate per-user SSH keys, or use a single "platform" key?
   - Recommendation: Use single platform SSH key stored in GitHub Secrets for Phase 7. Add per-user SSH keys in Phase 8 when implementing user-specific access controls.

3. **What's the optimal polling interval balance?**
   - What we know: Hetzner server creation takes 15-30 seconds; Tailscale enrollment takes 30-60 seconds
   - What's unclear: Trade-off between fast provisioning feedback and rate limit consumption
   - Recommendation:
     - Hetzner action polling: 1-second intervals (acceptable rate limit usage for <2 min duration)
     - Tailscale device polling: 2-second intervals (longer process, more aggressive polling less critical)

4. **Should we validate cloud-init config before sending to Hetzner?**
   - What we know: Hetzner API validates user_data; invalid configs cause server creation to fail
   - What's unclear: Is pre-validation worth the complexity, or rely on API errors?
   - Recommendation: Skip pre-validation for Phase 7. Use a static, tested cloud-init template with variable interpolation. Hetzner API errors are sufficient for catching issues.

## Sources

### Primary (HIGH confidence)
- [Hetzner Cloud API Reference](https://docs.hetzner.cloud/reference/cloud) - Server creation, actions, rate limits
- [Hetzner Cloud API Overview](https://docs.hetzner.cloud/) - Authentication, API structure
- [Tailscale OAuth Clients Documentation](https://tailscale.com/kb/1215/oauth-clients) - OAuth client setup, ephemeral auth keys
- [Hetzner Cloud Python Client Docs](https://hcloud-python.readthedocs.io/en/latest/api.clients.actions.html) - Action polling patterns
- [cloud-init Run Commands Documentation](https://cloudinit.readthedocs.io/en/latest/reference/yaml_examples/boot_cmds.html) - runcmd vs bootcmd

### Secondary (MEDIUM confidence)
- [Onat Mercan Blog: Tailscale on Hetzner (Jan 2026)](https://onatm.dev/2026/01/28/private-networking-on-hetzner-cloud-with-tailscale/) - Recent real-world implementation
- [Elliot Blackburn: Cloud-init SSL Clock Skew](https://www.elliotblackburn.com/certificate-not-yet-valid-when-installing-tailscale-via-cloud-init-on-raspberry-pi/) - Clock sync pitfall
- [Tailscale Cloud-Init Video](https://tailscale.com/blog/video-cloud-init-iac) - Official best practices
- [Tailscale Ephemeral Nodes Blog](https://tailscale.com/blog/ephemeral-logout) - Cleanup behavior
- [Kasper Grubbe: Tailscale + Terraform + cloud-init](https://kaspergrubbe.com/let-your-servers-join-your-tailscale-tailnet-with-terraform-and-cloud-init) - Production patterns

### Tertiary (LOW confidence - needs validation)
- [LowEndTalk: Hetzner provisioning speed discussion](https://lowendtalk.com/discussion/184625/) - Community discussion on 15-30 second provisioning
- [Hetzner server types pricing (CostGoat)](https://costgoat.com/pricing/hetzner) - CPX11/CX22 pricing (validate with official Hetzner console)
- [GitHub Issue: Ephemeral nodes not deleted](https://github.com/tailscale/tailscale/issues/14805) - Cleanup timing issues

## Metadata

**Confidence breakdown:**
- Hetzner Cloud API usage: HIGH - Official docs verified, response structures documented
- Tailscale OAuth + ephemeral keys: HIGH - Official Tailscale docs, clear API patterns
- cloud-init patterns: MEDIUM-HIGH - Official docs + 2026 real-world example validates approach
- Provisioning timings: MEDIUM - Based on community reports and SDK defaults, not official SLA
- Error handling strategies: MEDIUM - Inferred from API docs and best practices, needs field validation
- Rate limiting specifics: HIGH - Verified from official Hetzner docs (3600/hour limit)

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days; Hetzner API is stable, Tailscale OAuth is mature)

**Next validation needed:**
- Actual provisioning timing in production (15-30 sec for Hetzner, 30-60 sec for Tailscale enrollment)
- Tailscale devices API response structure (need to verify exact field names)
- Error response formats for Hetzner API (need to test 409, 422, 429 scenarios)
