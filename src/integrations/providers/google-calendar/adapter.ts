// ---------------------------------------------------------------------------
// Google Calendar adapter — extends OAuthAdapter for the unified framework.
//
// Google Calendar shares OAuth tokens with Gmail, Drive, and Docs under the
// unified "Google Workspace" provider (provider="google" in the DB). This
// adapter provides Calendar-specific chat tools and VM skill generation while
// reusing the shared Google OAuth configuration.
// ---------------------------------------------------------------------------

import {
  OAuthAdapter,
  type OAuthConfig,
  type ChatToolDefinition,
  type ValidationResult,
  type TokenRefreshResult,
  type CredentialEnvelope,
  type CredentialPayload,
  type VmSkillManifest,
} from "@/integrations/types";
import { CALENDAR_TOOLS, executeCalendarTool } from "./tools";
import { listCalendarEvents } from "./api";

// ---------- Metadata type ----------

export interface GoogleCalendarMetadata extends Record<string, unknown> {
  email: string;
  name?: string;
  picture?: string;
}

// ---------- Constants ----------

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// ---------- Adapter ----------

class GoogleCalendarAdapterImpl extends OAuthAdapter<GoogleCalendarMetadata> {
  readonly id = "google";
  readonly displayName = "Google Calendar";

  getOAuthConfig(): OAuthConfig {
    return {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: GOOGLE_TOKEN_URL,
      userInfoUrl: GOOGLE_USERINFO_URL,
      clientIdEnvVar: "GOOGLE_CLIENT_ID",
      clientSecretEnvVar: "GOOGLE_CLIENT_SECRET",
      scopes: GOOGLE_SCOPES,
      scopeDelimiter: " ",
      requestOfflineAccess: true,
      forceConsent: true,
    };
  }

  async processOAuthTokens(
    tokens: Record<string, unknown>,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    tokenExpiry?: Date;
    scopes: string[];
    metadata: GoogleCalendarMetadata;
  }> {
    const accessToken = tokens.access_token as string;
    const refreshToken = tokens.refresh_token as string | undefined;
    const expiresIn = tokens.expires_in as number | undefined;

    // Fetch user info
    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userInfo = userInfoRes.ok ? await userInfoRes.json() : {};

    // Parse scopes from response
    const scopeString = tokens.scope as string | undefined;
    const scopes = scopeString ? scopeString.split(" ") : GOOGLE_SCOPES;

    return {
      accessToken,
      refreshToken,
      tokenExpiry: expiresIn
        ? new Date(Date.now() + expiresIn * 1000)
        : undefined,
      scopes,
      metadata: {
        email: (userInfo.email as string) ?? "",
        name: userInfo.name as string | undefined,
        picture: userInfo.picture as string | undefined,
      },
    };
  }

  async validateCredentials(
    envelope: CredentialEnvelope,
  ): Promise<ValidationResult> {
    if (!envelope.accessToken) {
      return { valid: false, reason: "No access token stored" };
    }

    if (envelope.isExpired) {
      return { valid: false, reason: "Access token expired" };
    }

    // Lightweight validation: list 1 upcoming event
    try {
      await listCalendarEvents(envelope.accessToken, undefined, undefined, 1);
      return {
        valid: true,
        accountInfo: envelope.metadata,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Calendar validation failed";
      return { valid: false, reason: message };
    }
  }

  async refreshToken(
    envelope: CredentialEnvelope,
  ): Promise<TokenRefreshResult | null> {
    if (!envelope.refreshToken) return null;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: envelope.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      accessToken: data.access_token as string,
      tokenExpiry: new Date(
        Date.now() + ((data.expires_in as number) ?? 3600) * 1000,
      ),
      // Google does not rotate refresh tokens
    };
  }

  // ---- VM integration ----

  getVmSkillManifest(gatewayToken: string): VmSkillManifest {
    return {
      skillDirName: "google-workspace-skill",
      writeFiles: [
        {
          path: "/root/google-workspace-skill/SKILL.md",
          content: generateSkillMd(),
        },
      ],
      services: [],
      caddyRoutes: [
        {
          matchPath: "/internal/google-credentials",
          upstreamPort: 18790,
          rewritePath: "/credentials/google",
        },
      ],
    };
  }

  async buildVmCredentialPayload(
    envelope: CredentialEnvelope,
  ): Promise<CredentialPayload | null> {
    if (!envelope.accessToken || !envelope.refreshToken) return null;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    return {
      provider: "google",
      data: {
        email: (envelope.metadata.email as string) ?? "",
        accessToken: envelope.accessToken,
        refreshToken: envelope.refreshToken,
        tokenExpiry: envelope.tokenExpiry?.toISOString() ?? "",
        clientId,
        clientSecret,
      },
    };
  }

  // ---- Chat tools ----

  getChatTools(): ChatToolDefinition[] {
    return CALENDAR_TOOLS;
  }

  async executeChatTool(
    toolName: string,
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    return executeCalendarTool(toolName, args, accessToken);
  }
}

// ---------- SKILL.md content for OpenClaw ----------

function generateSkillMd(): string {
  return `# Google Workspace Skill

You have access to the user's Google Calendar and Gmail through CLI commands.

## Calendar Commands

### List Events
\`\`\`bash
node /root/google-workspace-skill/google-api.js calendar-list [--start ISO] [--end ISO] [--max N]
\`\`\`

### Create Event
\`\`\`bash
node /root/google-workspace-skill/google-api.js calendar-create --summary "Meeting" --start "2026-03-15T14:00:00Z" --end "2026-03-15T15:00:00Z" [--description "Notes"] [--attendees "a@co.com,b@co.com"]
\`\`\`

### Get Event Details
\`\`\`bash
node /root/google-workspace-skill/google-api.js calendar-get --id EVENT_ID
\`\`\`

### Update Event
\`\`\`bash
node /root/google-workspace-skill/google-api.js calendar-update --id EVENT_ID [--summary "New Title"] [--start ISO] [--end ISO] [--description "Updated"] [--location "Room 5"] [--attendees "a@co.com"]
\`\`\`

### Delete Event
\`\`\`bash
node /root/google-workspace-skill/google-api.js calendar-delete --id EVENT_ID
\`\`\`

### Check Availability
\`\`\`bash
node /root/google-workspace-skill/google-api.js calendar-freebusy --start "2026-03-15T09:00:00Z" --end "2026-03-15T18:00:00Z" [--calendars "primary,user@co.com"]
\`\`\`

## Gmail Commands

### List Emails
\`\`\`bash
node /root/google-workspace-skill/google-api.js mail-list [--query "is:unread"] [--max 10]
\`\`\`

### Read Email
\`\`\`bash
node /root/google-workspace-skill/google-api.js mail-read MESSAGE_ID
\`\`\`

### Send Email
\`\`\`bash
node /root/google-workspace-skill/google-api.js mail-send --to "recipient@example.com" --subject "Subject" --body "Message body"
\`\`\`

## Important Notes
- Tokens refresh automatically — you don't need to handle authentication.
- Always confirm with the user before sending emails, creating events, updating events, or deleting events.
- For Calendar operations, use ISO 8601 datetime format with timezone offset.
- When checking availability, you can pass multiple calendar IDs to find mutual free time.
`;
}

// ---------- Singleton export ----------

export const googleCalendarAdapter = new GoogleCalendarAdapterImpl();
