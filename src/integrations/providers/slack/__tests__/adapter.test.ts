import { describe, it, expect, vi, beforeEach } from "vitest";
import { slackAdapter } from "@/integrations/providers/slack/adapter";
import type { CredentialEnvelope } from "@/integrations/types";

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnvelope(
  overrides: Partial<CredentialEnvelope> = {},
): CredentialEnvelope {
  return {
    integrationId: "int-slack-1",
    userId: "user-456",
    provider: "slack",
    encryptedAccessToken: "enc-access",
    encryptedRefreshToken: "enc-refresh",
    accessToken: "xoxb-test-bot-token",
    refreshToken: "xoxr-test-refresh-token",
    tokenExpiry: new Date(Date.now() + 43200_000),
    isExpired: false,
    scopes: ["chat:write", "channels:read"],
    metadata: {
      teamId: "T12345",
      teamName: "Test Workspace",
      botUserId: "U_BOT",
      tokenRotationEnabled: true,
    },
    connectedAt: new Date(),
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SlackAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SLACK_CLIENT_ID", "test-client-id");
    vi.stubEnv("SLACK_CLIENT_SECRET", "test-client-secret");
  });

  // ---- Identity ----

  it("has correct id and display name", () => {
    expect(slackAdapter.id).toBe("slack");
    expect(slackAdapter.displayName).toBe("Slack");
    expect(slackAdapter.authStrategy).toBe("oauth2");
  });

  // ---- OAuth Config ----

  describe("getOAuthConfig", () => {
    it("returns correct OAuth configuration", () => {
      const config = slackAdapter.getOAuthConfig();

      expect(config.authorizationUrl).toBe(
        "https://slack.com/oauth/v2/authorize",
      );
      expect(config.tokenUrl).toBe("https://slack.com/api/oauth.v2.access");
      expect(config.clientIdEnvVar).toBe("SLACK_CLIENT_ID");
      expect(config.clientSecretEnvVar).toBe("SLACK_CLIENT_SECRET");
      expect(config.scopes).toContain("chat:write");
      expect(config.scopes).toContain("channels:read");
      expect(config.scopes).toContain("app_mentions:read");
      expect(config.scopeDelimiter).toBe(",");
      expect(config.extraAuthParams?.user_scope).toBe("search:read");
    });
  });

  // ---- processOAuthTokens ----

  describe("processOAuthTokens", () => {
    it("processes tokens with team info and user token", async () => {
      const result = await slackAdapter.processOAuthTokens({
        access_token: "xoxb-new-bot-token",
        refresh_token: "xoxr-refresh",
        expires_in: 43200,
        scope: "chat:write,channels:read,users:read",
        bot_user_id: "UBOT123",
        app_id: "A456",
        team: { id: "T789", name: "My Workspace" },
        authed_user: {
          id: "U_USER",
          scope: "search:read",
          access_token: "xoxp-user-token",
        },
      });

      expect(result.accessToken).toBe("xoxb-new-bot-token");
      expect(result.refreshToken).toBe("xoxr-refresh");
      expect(result.tokenExpiry).toBeInstanceOf(Date);
      expect(result.scopes).toContain("chat:write");
      expect(result.scopes).toContain("channels:read");
      expect(result.metadata.teamId).toBe("T789");
      expect(result.metadata.teamName).toBe("My Workspace");
      expect(result.metadata.botUserId).toBe("UBOT123");
      expect(result.metadata.userAccessToken).toBe("xoxp-user-token");
      expect(result.metadata.tokenRotationEnabled).toBe(true);
    });

    it("handles tokens without rotation (no expires_in)", async () => {
      const result = await slackAdapter.processOAuthTokens({
        access_token: "xoxb-bot",
        scope: "chat:write",
        bot_user_id: "UBOT",
        team: { id: "T1", name: "WS" },
      });

      expect(result.tokenExpiry).toBeUndefined();
      expect(result.metadata.tokenRotationEnabled).toBe(false);
    });
  });

  // ---- validateCredentials ----

  describe("validateCredentials", () => {
    it("returns valid when auth.test succeeds", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          team_id: "T12345",
          team: "Test Workspace",
          user_id: "U_BOT",
        }),
      );

      const result = await slackAdapter.validateCredentials(makeEnvelope());

      expect(result.valid).toBe(true);
      expect(result.accountInfo?.teamId).toBe("T12345");
    });

    it("returns invalid when token is revoked", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ ok: false, error: "token_revoked" }),
      );

      const result = await slackAdapter.validateCredentials(makeEnvelope());

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("revoked");
    });

    it("returns invalid when no access token", async () => {
      const result = await slackAdapter.validateCredentials(
        makeEnvelope({ accessToken: null }),
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("No access token");
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await slackAdapter.validateCredentials(makeEnvelope());

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Network error");
    });
  });

  // ---- refreshToken ----

  describe("refreshToken", () => {
    it("refreshes token when rotation is enabled", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          access_token: "xoxe-refreshed",
          refresh_token: "xoxr-new-refresh",
          expires_in: 43200,
        }),
      );

      const result = await slackAdapter.refreshToken!(makeEnvelope());

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe("xoxe-refreshed");
      expect(result!.tokenExpiry).toBeInstanceOf(Date);
      // Slack rotates refresh tokens
      expect(result!.refreshToken).toBe("xoxr-new-refresh");
    });

    it("returns null when rotation is not enabled", async () => {
      const result = await slackAdapter.refreshToken!(
        makeEnvelope({
          metadata: {
            teamId: "T1",
            teamName: "WS",
            botUserId: "U",
            tokenRotationEnabled: false,
          },
        }),
      );

      expect(result).toBeNull();
    });

    it("returns null when no refresh token", async () => {
      const result = await slackAdapter.refreshToken!(
        makeEnvelope({ refreshToken: null }),
      );

      expect(result).toBeNull();
    });

    it("returns null on refresh failure", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ ok: false, error: "invalid_refresh_token" }),
      );

      const result = await slackAdapter.refreshToken!(makeEnvelope());

      expect(result).toBeNull();
    });

    it("returns null when env vars are missing", async () => {
      vi.stubEnv("SLACK_CLIENT_ID", "");
      vi.stubEnv("SLACK_CLIENT_SECRET", "");

      const result = await slackAdapter.refreshToken!(makeEnvelope());

      expect(result).toBeNull();
    });
  });

  // ---- Chat Tools ----

  describe("getChatTools", () => {
    it("returns messaging tool definitions", () => {
      const tools = slackAdapter.getChatTools();

      expect(tools.length).toBeGreaterThan(0);
      const toolNames = tools.map((t) => t.function.name);
      expect(toolNames).toContain("slack_send_message");
      expect(toolNames).toContain("slack_list_channels");
      expect(toolNames).toContain("slack_read_messages");
      expect(toolNames).toContain("slack_search_messages");
    });
  });

  // ---- executeChatTool ----

  describe("executeChatTool", () => {
    it("sends a message via chat.postMessage", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          channel: "C123",
          ts: "1234567890.123456",
        }),
      );

      const result = await slackAdapter.executeChatTool!(
        "slack_send_message",
        { channel: "C123", text: "Hello world" },
        "xoxb-tok",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("chat.postMessage"),
        expect.objectContaining({ method: "POST" }),
      );
      expect((result as Record<string, unknown>).ok).toBe(true);
    });

    it("lists channels", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          channels: [
            { id: "C1", name: "general", topic: { value: "General" }, num_members: 10, is_private: false },
          ],
        }),
      );

      const result = await slackAdapter.executeChatTool!(
        "slack_list_channels",
        { limit: 10 },
        "xoxb-tok",
      );

      const channels = (result as Record<string, unknown>).channels as unknown[];
      expect(channels).toHaveLength(1);
    });

    it("reads messages from a channel", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          messages: [
            { user: "U1", text: "Hello", ts: "123", type: "message" },
          ],
          has_more: false,
        }),
      );

      const result = await slackAdapter.executeChatTool!(
        "slack_read_messages",
        { channel: "C123", limit: 5 },
        "xoxb-tok",
      );

      const messages = (result as Record<string, unknown>).messages as unknown[];
      expect(messages).toHaveLength(1);
    });

    it("returns error for unknown tool", async () => {
      const result = await slackAdapter.executeChatTool!(
        "slack_unknown",
        {},
        "xoxb-tok",
      );

      expect((result as Record<string, unknown>).error).toContain("Unknown tool");
    });
  });

  // ---- Base class defaults ----

  it("returns null for getApiKeyFields", () => {
    expect(slackAdapter.getApiKeyFields()).toBeNull();
  });
});
