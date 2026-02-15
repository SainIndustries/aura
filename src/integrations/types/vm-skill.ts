// ---------------------------------------------------------------------------
// VM-side skill artifact types for cloud-init integration.
//
// When an integration runs on the agent's VM (via OpenClaw skills), the
// adapter generates these artifacts during provisioning. The provisioning
// system (`hetzner.ts`) consumes them to build the cloud-init YAML.
// ---------------------------------------------------------------------------

/**
 * A file to write to the VM via cloud-init's `write_files` directive.
 *
 * IMPORTANT: File content must NOT use bash heredocs (cloud-init YAML
 * indentation breaks heredoc closing markers). Use `write_files` directive.
 */
export interface VmWriteFile {
  /** Absolute path on the VM (e.g., "/root/google-workspace-skill/google-api.js"). */
  path: string;

  /** File content (placed under `content: |` in cloud-init YAML). */
  content: string;

  /** File owner. Default: "root:root". */
  owner?: string;

  /** File permissions as octal string. Default: "0644". */
  permissions?: string;
}

/**
 * A systemd service to install on the VM.
 */
export interface VmSystemdService {
  /** Service name without `.service` suffix. Example: "cred-receiver". */
  name: string;

  /** Complete systemd unit file content ([Unit], [Service], [Install] blocks). */
  unitFileContent: string;

  /** Whether to enable the service at boot (`systemctl enable`). Default: true. */
  enableAtBoot?: boolean;
}

/**
 * A Caddy reverse proxy route to add to the VM's Caddyfile.
 *
 * Routes requests from the VM's public IP to internal services.
 * The existing pattern uses Caddy to route `/internal/*` paths to
 * credential receivers while everything else goes to OpenClaw.
 */
export interface VmCaddyRoute {
  /**
   * URL path to match (e.g., "/internal/google-credentials").
   * Placed inside a Caddy `handle` block.
   */
  matchPath: string;

  /** Internal port to proxy to (e.g., 18790). */
  upstreamPort: number;

  /**
   * Optional path rewrite applied before proxying.
   * Example: "/credentials/google" rewrites the matched path before
   * forwarding to the upstream service.
   */
  rewritePath?: string;
}

/**
 * Complete VM-side skill manifest returned by `IntegrationAdapter.getVmSkillManifest()`.
 *
 * The provisioning system uses this to:
 *  1. Add entries to cloud-init's `write_files:` block
 *  2. Generate and enable systemd services
 *  3. Configure Caddy reverse proxy routes
 *  4. Add the skill directory to OpenClaw's `skills.load.extraDirs`
 */
export interface VmSkillManifest {
  /**
   * Skill directory name (must be a valid directory name).
   * Files are placed under `/root/{skillDirName}/`.
   * This path is added to OpenClaw's `skills.load.extraDirs` config.
   */
  skillDirName: string;

  /** Files to write to the VM during cloud-init. */
  writeFiles: VmWriteFile[];

  /** Systemd services to install and start. */
  services: VmSystemdService[];

  /** Caddy routes to add to the Caddyfile. */
  caddyRoutes: VmCaddyRoute[];

  /**
   * Pre-populated credential file, written during cloud-init when the user
   * has already connected this integration before the VM was provisioned.
   * `null` if no credentials are available at provisioning time.
   */
  prePopulatedCredentials?: VmWriteFile | null;
}
