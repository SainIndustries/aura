// ---------------------------------------------------------------------------
// Slack adapter — OAuth 2.0 integration for messaging, channels, search,
// reactions, and file sharing.
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

export interface SlackMetadata extends Record<string, unknown> {
  teamId: string;
  teamName: string;
  botUserId: string;
  appId?: string;
  /** Encrypted user token for search.messages (xoxp-) — bot tokens cannot search. */
  userAccessToken?: string;
  /** Whether token rotation is enabled (determines refresh behavior). */
  tokenRotationEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

const SLACK_BOT_SCOPES = [
  "app_mentions:read",
  "channels:read",
  "channels:history",
  "groups:read",
  "groups:history",
  "im:read",
  "im:history",
  "chat:write",
  "chat:write.public",
  "users:read",
  "users:read.email",
  "reactions:read",
  "reactions:write",
  "files:read",
  "files:write",
];

const SLACK_USER_SCOPES = ["search:read"];

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const SLACK_API_BASE = "https://slack.com/api";

async function slackFetch(
  method: string,
  accessToken: string,
  params?: Record<string, string>,
  body?: Record<string, unknown>,
): Promise<Response> {
  const url = new URL(`${SLACK_API_BASE}/${method}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const options: RequestInit = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
  };

  if (body) {
    options.method = "POST";
    options.body = JSON.stringify(body);
  }

  return fetch(url.toString(), options);
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

class SlackAdapter extends OAuthAdapter<SlackMetadata> {
  readonly id = "slack";
  readonly displayName = "Slack";

  getOAuthConfig(): OAuthConfig {
    return {
      authorizationUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      clientIdEnvVar: "SLACK_CLIENT_ID",
      clientSecretEnvVar: "SLACK_CLIENT_SECRET",
      scopes: SLACK_BOT_SCOPES,
      scopeDelimiter: ",",
      extraAuthParams: {
        user_scope: SLACK_USER_SCOPES.join(","),
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
    metadata: SlackMetadata;
  }> {
    // Bot token is the primary access token
    const accessToken = tokens.access_token as string;
    const refreshToken = tokens.refresh_token as string | undefined;
    const expiresIn = tokens.expires_in as number | undefined;

    // Token rotation: if expires_in is present, rotation is enabled
    const tokenRotationEnabled = !!expiresIn;
    const tokenExpiry = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : undefined;

    // Parse bot scopes
    const scopeStr = tokens.scope as string | undefined;
    const scopes = scopeStr ? scopeStr.split(",") : SLACK_BOT_SCOPES;

    // Extract team/bot info
    const team = tokens.team as Record<string, string> | undefined;
    const botUserId = (tokens.bot_user_id as string) ?? "";
    const appId = (tokens.app_id as string) ?? "";

    // Extract user token (for search.messages)
    const authedUser = tokens.authed_user as Record<string, unknown> | undefined;
    const userAccessToken = authedUser?.access_token as string | undefined;

    return {
      accessToken,
      refreshToken,
      tokenExpiry,
      scopes,
      metadata: {
        teamId: team?.id ?? "",
        teamName: team?.name ?? "",
        botUserId,
        appId,
        userAccessToken,
        tokenRotationEnabled,
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
      const res = await slackFetch("auth.test", envelope.accessToken);

      if (!res.ok) {
        return { valid: false, reason: `API error: ${res.status}` };
      }

      const data = await res.json();
      if (!data.ok) {
        return {
          valid: false,
          reason: data.error === "token_revoked"
            ? "Token has been revoked"
            : `Slack error: ${data.error}`,
        };
      }

      return {
        valid: true,
        accountInfo: {
          teamId: data.team_id,
          teamName: data.team,
          botUserId: data.user_id,
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
    // Slack tokens don't expire unless token rotation is enabled
    const meta = envelope.metadata as SlackMetadata;
    if (!meta?.tokenRotationEnabled) {
      return null;
    }

    if (!envelope.refreshToken) {
      console.error("[Slack] No refresh token available");
      return null;
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error("[Slack] Missing client credentials env vars");
      return null;
    }

    try {
      const res = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: envelope.refreshToken,
        }),
      });

      if (!res.ok) {
        console.error("[Slack] Token refresh failed:", await res.text());
        return null;
      }

      const data = await res.json();
      if (!data.ok) {
        console.error("[Slack] Token refresh error:", data.error);
        return null;
      }

      const expiresIn = (data.expires_in as number) ?? 43200;

      return {
        accessToken: data.access_token,
        tokenExpiry: new Date(Date.now() + expiresIn * 1000),
        // Slack rotates refresh tokens on each refresh
        refreshToken: data.refresh_token,
      };
    } catch (err) {
      console.error("[Slack] Token refresh error:", err);
      return null;
    }
  }

  getChatTools(): ChatToolDefinition[] {
    return [
      {
        type: "function",
        function: {
          name: "slack_send_message",
          description:
            "Send a message to a Slack channel or direct message",
          parameters: {
            type: "object",
            properties: {
              channel: {
                type: "string",
                description:
                  "Channel ID (C...), group ID (G...), or user ID (U...) to send to",
              },
              text: {
                type: "string",
                description: "Message text (max 4000 characters)",
              },
              thread_ts: {
                type: "string",
                description:
                  "Parent message timestamp to reply in a thread",
              },
            },
            required: ["channel", "text"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "slack_list_channels",
          description:
            "List Slack channels the bot has access to",
          parameters: {
            type: "object",
            properties: {
              types: {
                type: "string",
                description:
                  "Comma-separated channel types: public_channel, private_channel, mpim, im (default: public_channel)",
              },
              limit: {
                type: "number",
                description: "Max channels to return (default: 100, max: 200)",
              },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "slack_read_messages",
          description:
            "Read recent messages from a Slack channel",
          parameters: {
            type: "object",
            properties: {
              channel: {
                type: "string",
                description: "Channel ID to read from",
              },
              limit: {
                type: "number",
                description:
                  "Number of messages to return (default: 20, max: 100)",
              },
            },
            required: ["channel"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "slack_search_messages",
          description:
            "Search for messages across the workspace. Supports query operators like in:channel and from:@user",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "Search query (supports in:channel, from:@user operators)",
              },
              count: {
                type: "number",
                description: "Results per page (default: 20, max: 100)",
              },
              sort: {
                type: "string",
                description: "Sort by: score or timestamp (default: score)",
              },
            },
            required: ["query"],
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
      case "slack_send_message":
        return this.sendMessage(args, accessToken);
      case "slack_list_channels":
        return this.listChannels(args, accessToken);
      case "slack_read_messages":
        return this.readMessages(args, accessToken);
      case "slack_search_messages":
        return this.searchMessages(args, accessToken);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  // ---- Private helpers ----

  private async sendMessage(
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const text = ((args.text as string) ?? "").slice(0, 4000);

    const body: Record<string, unknown> = {
      channel: args.channel as string,
      text,
    };
    if (args.thread_ts) {
      body.thread_ts = args.thread_ts as string;
    }

    const res = await slackFetch("chat.postMessage", accessToken, undefined, body);
    if (!res.ok) {
      return { error: `Send failed: ${res.status}` };
    }

    const data = await res.json();
    if (!data.ok) {
      return { error: `Slack error: ${data.error}` };
    }

    return {
      ok: true,
      channel: data.channel,
      ts: data.ts,
    };
  }

  private async listChannels(
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const limit = Math.min(Number(args.limit) || 100, 200);
    const types = (args.types as string) ?? "public_channel";

    const res = await slackFetch("conversations.list", accessToken, {
      types,
      limit: String(limit),
      exclude_archived: "true",
    });

    if (!res.ok) {
      return { error: `List failed: ${res.status}` };
    }

    const data = await res.json();
    if (!data.ok) {
      return { error: `Slack error: ${data.error}` };
    }

    return {
      channels: (data.channels ?? []).map((ch: Record<string, unknown>) => ({
        id: ch.id,
        name: ch.name,
        topic: (ch.topic as Record<string, unknown>)?.value ?? "",
        num_members: ch.num_members,
        is_private: ch.is_private,
      })),
    };
  }

  private async readMessages(
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const limit = Math.min(Number(args.limit) || 20, 100);

    const res = await slackFetch("conversations.history", accessToken, {
      channel: args.channel as string,
      limit: String(limit),
    });

    if (!res.ok) {
      return { error: `Read failed: ${res.status}` };
    }

    const data = await res.json();
    if (!data.ok) {
      return { error: `Slack error: ${data.error}` };
    }

    return {
      messages: (data.messages ?? []).map((msg: Record<string, unknown>) => ({
        user: msg.user,
        text: msg.text,
        ts: msg.ts,
        type: msg.type,
        thread_ts: msg.thread_ts,
      })),
      has_more: data.has_more,
    };
  }

  private async searchMessages(
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    // search.messages requires a user token (xoxp-), not a bot token
    // The accessToken passed here is the bot token; for search we'd need
    // the user token from metadata. In fallback mode, we use what we have.
    const count = Math.min(Number(args.count) || 20, 100);
    const sort = (args.sort as string) ?? "score";

    const res = await slackFetch("search.messages", accessToken, {
      query: args.query as string,
      count: String(count),
      sort,
    });

    if (!res.ok) {
      return { error: `Search failed: ${res.status}` };
    }

    const data = await res.json();
    if (!data.ok) {
      return {
        error: `Slack error: ${data.error}`,
        hint: data.error === "missing_scope"
          ? "search.messages requires a user token (xoxp-), not a bot token"
          : undefined,
      };
    }

    const matches = data.messages?.matches ?? [];
    return {
      total: data.messages?.total ?? 0,
      messages: matches.slice(0, count).map((m: Record<string, unknown>) => ({
        text: m.text,
        user: (m.username as string) ?? m.user,
        channel: (m.channel as Record<string, unknown>)?.name,
        ts: m.ts,
        permalink: m.permalink,
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const slackAdapter = new SlackAdapter();
