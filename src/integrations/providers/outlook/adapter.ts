// ---------------------------------------------------------------------------
// Outlook adapter — OAuth 2.0 integration for Microsoft 365 email,
// calendar, and contacts via Microsoft Graph API.
// ---------------------------------------------------------------------------

import {
  OAuthAdapter,
  type OAuthConfig,
  type CredentialEnvelope,
  type ValidationResult,
  type TokenRefreshResult,
  type ChatToolDefinition,
} from "@/integrations/types";

// ---------------------------------------------------------------------------
// Metadata stored in integrations.metadata JSONB
// ---------------------------------------------------------------------------

export interface OutlookMetadata extends Record<string, unknown> {
  email: string;
  displayName?: string;
  tenantId?: string;
}

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

const OUTLOOK_SCOPES = [
  "offline_access",
  "User.Read",
  "Mail.Read",
  "Mail.Send",
  "Calendars.ReadWrite",
  "Contacts.Read",
];

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

async function graphFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${GRAPH_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

class OutlookAdapter extends OAuthAdapter<OutlookMetadata> {
  readonly id = "outlook";
  readonly displayName = "Outlook";

  getOAuthConfig(): OAuthConfig {
    return {
      authorizationUrl:
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl:
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      userInfoUrl: "https://graph.microsoft.com/v1.0/me",
      clientIdEnvVar: "MICROSOFT_CLIENT_ID",
      clientSecretEnvVar: "MICROSOFT_CLIENT_SECRET",
      scopes: OUTLOOK_SCOPES,
      scopeDelimiter: " ",
      extraAuthParams: {
        response_mode: "query",
      },
    };
  }

  async processOAuthTokens(
    tokens: Record<string, unknown>,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    tokenExpiry?: Date;
    scopes: string[];
    metadata: OutlookMetadata;
  }> {
    const accessToken = tokens.access_token as string;
    const refreshToken = tokens.refresh_token as string | undefined;
    const expiresIn = tokens.expires_in as number | undefined;

    // Microsoft access tokens typically last 60-90 minutes
    const tokenExpiry = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : new Date(Date.now() + 3600 * 1000);

    // Parse scopes
    const scopeStr = tokens.scope as string | undefined;
    const scopes = scopeStr ? scopeStr.split(" ") : OUTLOOK_SCOPES;

    // Fetch user profile for metadata
    let email = "";
    let displayName: string | undefined;
    let tenantId: string | undefined;

    try {
      const userRes = await graphFetch("/me", accessToken);
      if (userRes.ok) {
        const user = await userRes.json();
        email = user.mail ?? user.userPrincipalName ?? "";
        displayName = user.displayName;
      }
    } catch (err) {
      console.error("[Outlook] Failed to fetch user profile:", err);
    }

    // Extract tenant ID from the token response if available
    if (tokens.id_token) {
      try {
        // Decode JWT payload (second segment) to get tenant ID
        const payload = JSON.parse(
          Buffer.from(
            (tokens.id_token as string).split(".")[1],
            "base64",
          ).toString(),
        );
        tenantId = payload.tid;
      } catch {
        // Non-critical — skip
      }
    }

    return {
      accessToken,
      refreshToken,
      tokenExpiry,
      scopes,
      metadata: {
        email,
        displayName,
        tenantId,
      },
    };
  }

  async validateCredentials(
    envelope: CredentialEnvelope,
  ): Promise<ValidationResult> {
    if (!envelope.accessToken) {
      return { valid: false, reason: "No access token stored" };
    }

    try {
      const res = await graphFetch("/me", envelope.accessToken);

      if (res.status === 401) {
        return { valid: false, reason: "Access token expired or revoked" };
      }

      if (!res.ok) {
        return { valid: false, reason: `API error: ${res.status}` };
      }

      const user = await res.json();
      return {
        valid: true,
        accountInfo: {
          email: user.mail ?? user.userPrincipalName,
          displayName: user.displayName,
        },
      };
    } catch (err) {
      return {
        valid: false,
        reason: `Connection failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  }

  async refreshToken(
    envelope: CredentialEnvelope,
  ): Promise<TokenRefreshResult | null> {
    if (!envelope.refreshToken) {
      console.error("[Outlook] No refresh token available");
      return null;
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error("[Outlook] Missing client credentials env vars");
      return null;
    }

    try {
      const res = await fetch(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: envelope.refreshToken,
            scope: OUTLOOK_SCOPES.join(" "),
          }),
        },
      );

      if (!res.ok) {
        console.error("[Outlook] Token refresh failed:", await res.text());
        return null;
      }

      const data = await res.json();
      const expiresIn = (data.expires_in as number) ?? 3600;

      return {
        accessToken: data.access_token,
        tokenExpiry: new Date(Date.now() + expiresIn * 1000),
        // Microsoft may rotate refresh tokens — store if returned
        refreshToken: data.refresh_token ?? undefined,
      };
    } catch (err) {
      console.error("[Outlook] Token refresh error:", err);
      return null;
    }
  }

  getChatTools(): ChatToolDefinition[] {
    return [
      {
        type: "function",
        function: {
          name: "outlook_send_email",
          description: "Send an email via Outlook / Microsoft 365",
          parameters: {
            type: "object",
            properties: {
              to: {
                type: "string",
                description: "Recipient email address",
              },
              subject: {
                type: "string",
                description: "Email subject",
              },
              body: {
                type: "string",
                description: "Email body (HTML supported)",
              },
              cc: {
                type: "string",
                description: "CC recipient email address",
              },
            },
            required: ["to", "subject", "body"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "outlook_list_messages",
          description:
            "List recent emails from the user's Outlook inbox",
          parameters: {
            type: "object",
            properties: {
              top: {
                type: "number",
                description: "Number of messages to return (default: 10, max: 50)",
              },
              filter: {
                type: "string",
                description:
                  "OData filter (e.g., isRead eq false, from/emailAddress/address eq 'user@example.com')",
              },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "outlook_search_messages",
          description:
            "Search emails using KQL syntax (e.g., from:john subject:invoice)",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "Search query using KQL (subject:, from:, to:, body:, hasAttachments:)",
              },
              top: {
                type: "number",
                description: "Max results (default: 10, max: 25)",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "outlook_list_events",
          description:
            "List calendar events from the user's Outlook calendar",
          parameters: {
            type: "object",
            properties: {
              startDateTime: {
                type: "string",
                description: "Start of time range (ISO 8601)",
              },
              endDateTime: {
                type: "string",
                description: "End of time range (ISO 8601)",
              },
              top: {
                type: "number",
                description: "Max events to return (default: 10, max: 50)",
              },
            },
            required: ["startDateTime", "endDateTime"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "outlook_create_event",
          description:
            "Create a calendar event in the user's Outlook calendar",
          parameters: {
            type: "object",
            properties: {
              subject: { type: "string", description: "Event subject" },
              start: {
                type: "string",
                description: "Start time (ISO 8601)",
              },
              end: {
                type: "string",
                description: "End time (ISO 8601)",
              },
              timeZone: {
                type: "string",
                description: "Time zone (e.g., America/New_York). Default: UTC",
              },
              body: {
                type: "string",
                description: "Event body/description",
              },
              attendees: {
                type: "string",
                description: "Comma-separated attendee email addresses",
              },
              location: {
                type: "string",
                description: "Event location",
              },
            },
            required: ["subject", "start", "end"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "outlook_list_contacts",
          description: "List contacts from the user's Outlook address book",
          parameters: {
            type: "object",
            properties: {
              top: {
                type: "number",
                description: "Max contacts to return (default: 20, max: 50)",
              },
              search: {
                type: "string",
                description: "Search contacts by display name",
              },
            },
          },
        },
      },
    ];
  }

  async executeChatTool(
    toolName: string,
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    switch (toolName) {
      case "outlook_send_email":
        return this.sendEmail(args, accessToken);
      case "outlook_list_messages":
        return this.listMessages(args, accessToken);
      case "outlook_search_messages":
        return this.searchMessages(args, accessToken);
      case "outlook_list_events":
        return this.listEvents(args, accessToken);
      case "outlook_create_event":
        return this.createEvent(args, accessToken);
      case "outlook_list_contacts":
        return this.listContacts(args, accessToken);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  // ---- Private helpers ----

  private async sendEmail(
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const toRecipients = [
      { emailAddress: { address: args.to as string } },
    ];
    const ccRecipients = args.cc
      ? [{ emailAddress: { address: args.cc as string } }]
      : undefined;

    const message: Record<string, unknown> = {
      subject: args.subject as string,
      body: {
        contentType: "HTML",
        content: args.body as string,
      },
      toRecipients,
    };
    if (ccRecipients) {
      message.ccRecipients = ccRecipients;
    }

    const res = await graphFetch("/me/sendMail", accessToken, {
      method: "POST",
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    // 202 Accepted = success (no body returned)
    if (res.status === 202) {
      return { success: true, to: args.to };
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        error: `Send failed: ${res.status}`,
        details: (err as Record<string, unknown>).error,
      };
    }

    return { success: true, to: args.to };
  }

  private async listMessages(
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const top = Math.min(Number(args.top) || 10, 50);
    let path = `/me/messages?$top=${top}&$select=subject,from,receivedDateTime,isRead,bodyPreview&$orderby=receivedDateTime desc`;

    if (args.filter) {
      path += `&$filter=${encodeURIComponent(args.filter as string)}`;
    }

    const res = await graphFetch(path, accessToken);
    if (!res.ok) {
      return { error: `List failed: ${res.status}` };
    }

    const data = await res.json();
    return {
      messages: (data.value ?? []).map((m: Record<string, unknown>) => ({
        id: m.id,
        subject: m.subject,
        from: (m.from as Record<string, unknown>)?.emailAddress,
        receivedDateTime: m.receivedDateTime,
        isRead: m.isRead,
        bodyPreview: m.bodyPreview,
      })),
    };
  }

  private async searchMessages(
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const top = Math.min(Number(args.top) || 10, 25);
    const query = encodeURIComponent(`"${args.query as string}"`);
    const path = `/me/messages?$search=${query}&$top=${top}&$select=subject,from,receivedDateTime,bodyPreview`;

    const res = await graphFetch(path, accessToken);
    if (!res.ok) {
      return { error: `Search failed: ${res.status}` };
    }

    const data = await res.json();
    return {
      messages: (data.value ?? []).map((m: Record<string, unknown>) => ({
        id: m.id,
        subject: m.subject,
        from: (m.from as Record<string, unknown>)?.emailAddress,
        receivedDateTime: m.receivedDateTime,
        bodyPreview: m.bodyPreview,
      })),
    };
  }

  private async listEvents(
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const top = Math.min(Number(args.top) || 10, 50);
    const startDateTime = encodeURIComponent(args.startDateTime as string);
    const endDateTime = encodeURIComponent(args.endDateTime as string);

    const path = `/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$top=${top}&$select=subject,start,end,location,organizer,isAllDay`;

    const res = await graphFetch(path, accessToken);
    if (!res.ok) {
      return { error: `List events failed: ${res.status}` };
    }

    const data = await res.json();
    return {
      events: (data.value ?? []).map((e: Record<string, unknown>) => ({
        id: e.id,
        subject: e.subject,
        start: e.start,
        end: e.end,
        location: (e.location as Record<string, unknown>)?.displayName,
        organizer: (e.organizer as Record<string, unknown>)?.emailAddress,
        isAllDay: e.isAllDay,
      })),
    };
  }

  private async createEvent(
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const timeZone = (args.timeZone as string) ?? "UTC";

    const event: Record<string, unknown> = {
      subject: args.subject as string,
      start: { dateTime: args.start as string, timeZone },
      end: { dateTime: args.end as string, timeZone },
    };

    if (args.body) {
      event.body = { contentType: "HTML", content: args.body as string };
    }
    if (args.location) {
      event.location = { displayName: args.location as string };
    }
    if (args.attendees) {
      event.attendees = (args.attendees as string).split(",").map((email) => ({
        emailAddress: { address: email.trim() },
        type: "required",
      }));
    }

    const res = await graphFetch("/me/events", accessToken, {
      method: "POST",
      body: JSON.stringify(event),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        error: `Create event failed: ${res.status}`,
        details: (err as Record<string, unknown>).error,
      };
    }

    const created = await res.json();
    return {
      id: created.id,
      subject: created.subject,
      start: created.start,
      end: created.end,
      webLink: created.webLink,
    };
  }

  private async listContacts(
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const top = Math.min(Number(args.top) || 20, 50);
    let path = `/me/contacts?$top=${top}&$select=displayName,emailAddresses,mobilePhone,companyName,jobTitle`;

    if (args.search) {
      path += `&$search="${encodeURIComponent(args.search as string)}"`;
    }

    const res = await graphFetch(path, accessToken);
    if (!res.ok) {
      return { error: `List contacts failed: ${res.status}` };
    }

    const data = await res.json();
    return {
      contacts: (data.value ?? []).map((c: Record<string, unknown>) => ({
        id: c.id,
        displayName: c.displayName,
        emailAddresses: c.emailAddresses,
        mobilePhone: c.mobilePhone,
        companyName: c.companyName,
        jobTitle: c.jobTitle,
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const outlookAdapter = new OutlookAdapter();
