import { describe, it, expect, vi, beforeEach } from "vitest";
import { outlookAdapter } from "@/integrations/providers/outlook/adapter";
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
    integrationId: "int-outlook-1",
    userId: "user-456",
    provider: "outlook",
    encryptedAccessToken: "enc-access",
    encryptedRefreshToken: "enc-refresh",
    accessToken: "eyJ0eXAi-test-access-token",
    refreshToken: "test-refresh-token",
    tokenExpiry: new Date(Date.now() + 3600_000),
    isExpired: false,
    scopes: ["Mail.Read", "Mail.Send", "Calendars.ReadWrite"],
    metadata: {
      email: "user@example.com",
      displayName: "Test User",
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

describe("OutlookAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MICROSOFT_CLIENT_ID", "test-client-id");
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "test-client-secret");
  });

  // ---- Identity ----

  it("has correct id and display name", () => {
    expect(outlookAdapter.id).toBe("outlook");
    expect(outlookAdapter.displayName).toBe("Outlook");
    expect(outlookAdapter.authStrategy).toBe("oauth2");
  });

  // ---- OAuth Config ----

  describe("getOAuthConfig", () => {
    it("returns correct OAuth configuration", () => {
      const config = outlookAdapter.getOAuthConfig();

      expect(config.authorizationUrl).toContain(
        "login.microsoftonline.com/common",
      );
      expect(config.tokenUrl).toContain(
        "login.microsoftonline.com/common",
      );
      expect(config.userInfoUrl).toBe(
        "https://graph.microsoft.com/v1.0/me",
      );
      expect(config.clientIdEnvVar).toBe("MICROSOFT_CLIENT_ID");
      expect(config.clientSecretEnvVar).toBe("MICROSOFT_CLIENT_SECRET");
      expect(config.scopes).toContain("offline_access");
      expect(config.scopes).toContain("Mail.Read");
      expect(config.scopes).toContain("Mail.Send");
      expect(config.scopes).toContain("Calendars.ReadWrite");
      expect(config.scopes).toContain("Contacts.Read");
      expect(config.scopeDelimiter).toBe(" ");
      expect(config.extraAuthParams?.response_mode).toBe("query");
    });
  });

  // ---- processOAuthTokens ----

  describe("processOAuthTokens", () => {
    it("processes tokens and fetches user profile", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          mail: "john@example.com",
          displayName: "John Doe",
          userPrincipalName: "john@example.com",
        }),
      );

      const result = await outlookAdapter.processOAuthTokens({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
        scope: "Mail.Read Mail.Send Calendars.ReadWrite",
      });

      expect(result.accessToken).toBe("new-access-token");
      expect(result.refreshToken).toBe("new-refresh-token");
      expect(result.tokenExpiry).toBeInstanceOf(Date);
      expect(result.scopes).toContain("Mail.Read");
      expect(result.metadata.email).toBe("john@example.com");
      expect(result.metadata.displayName).toBe("John Doe");
    });

    it("handles user profile fetch failure gracefully", async () => {
      mockFetch.mockResolvedValueOnce(new Response("error", { status: 500 }));

      const result = await outlookAdapter.processOAuthTokens({
        access_token: "tok",
        expires_in: 3600,
      });

      expect(result.accessToken).toBe("tok");
      expect(result.metadata.email).toBe("");
    });

    it("extracts tenant ID from id_token JWT", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ mail: "a@b.com", displayName: "A" }),
      );

      // Create a fake JWT with tenant ID
      const payload = Buffer.from(
        JSON.stringify({ tid: "tenant-123" }),
      ).toString("base64");
      const fakeJwt = `header.${payload}.signature`;

      const result = await outlookAdapter.processOAuthTokens({
        access_token: "tok",
        expires_in: 3600,
        id_token: fakeJwt,
      });

      expect(result.metadata.tenantId).toBe("tenant-123");
    });
  });

  // ---- validateCredentials ----

  describe("validateCredentials", () => {
    it("returns valid when Graph API responds 200", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          mail: "user@example.com",
          displayName: "Test User",
          userPrincipalName: "user@example.com",
        }),
      );

      const result = await outlookAdapter.validateCredentials(makeEnvelope());

      expect(result.valid).toBe(true);
      expect(result.accountInfo?.email).toBe("user@example.com");
    });

    it("returns invalid when token is expired (401)", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 }),
      );

      const result = await outlookAdapter.validateCredentials(makeEnvelope());

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("expired or revoked");
    });

    it("returns invalid when no access token", async () => {
      const result = await outlookAdapter.validateCredentials(
        makeEnvelope({ accessToken: null }),
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("No access token");
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await outlookAdapter.validateCredentials(makeEnvelope());

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Network error");
    });
  });

  // ---- refreshToken ----

  describe("refreshToken", () => {
    it("refreshes token successfully", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          access_token: "refreshed-access",
          refresh_token: "rotated-refresh",
          expires_in: 3600,
        }),
      );

      const result = await outlookAdapter.refreshToken!(makeEnvelope());

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe("refreshed-access");
      expect(result!.tokenExpiry).toBeInstanceOf(Date);
      // Microsoft may rotate refresh tokens
      expect(result!.refreshToken).toBe("rotated-refresh");
    });

    it("returns null when no refresh token", async () => {
      const result = await outlookAdapter.refreshToken!(
        makeEnvelope({ refreshToken: null }),
      );

      expect(result).toBeNull();
    });

    it("returns null on refresh failure", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Bad Request", { status: 400 }),
      );

      const result = await outlookAdapter.refreshToken!(makeEnvelope());

      expect(result).toBeNull();
    });

    it("returns null when env vars are missing", async () => {
      vi.stubEnv("MICROSOFT_CLIENT_ID", "");
      vi.stubEnv("MICROSOFT_CLIENT_SECRET", "");

      const result = await outlookAdapter.refreshToken!(makeEnvelope());

      expect(result).toBeNull();
    });
  });

  // ---- Chat Tools ----

  describe("getChatTools", () => {
    it("returns email, calendar, and contacts tool definitions", () => {
      const tools = outlookAdapter.getChatTools();

      expect(tools.length).toBeGreaterThan(0);
      const toolNames = tools.map((t) => t.function.name);
      expect(toolNames).toContain("outlook_send_email");
      expect(toolNames).toContain("outlook_list_messages");
      expect(toolNames).toContain("outlook_search_messages");
      expect(toolNames).toContain("outlook_list_events");
      expect(toolNames).toContain("outlook_create_event");
      expect(toolNames).toContain("outlook_list_contacts");
    });
  });

  // ---- executeChatTool ----

  describe("executeChatTool", () => {
    it("sends an email via Graph API", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 202 }),
      );

      const result = await outlookAdapter.executeChatTool!(
        "outlook_send_email",
        { to: "user@example.com", subject: "Test", body: "<p>Hello</p>" },
        "access-tok",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/me/sendMail"),
        expect.objectContaining({ method: "POST" }),
      );
      expect((result as Record<string, unknown>).success).toBe(true);
    });

    it("lists messages with filter", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              id: "msg1",
              subject: "Hello",
              from: { emailAddress: { address: "a@b.com" } },
              receivedDateTime: "2026-01-01T00:00:00Z",
              isRead: false,
              bodyPreview: "Preview...",
            },
          ],
        }),
      );

      const result = await outlookAdapter.executeChatTool!(
        "outlook_list_messages",
        { top: 5, filter: "isRead eq false" },
        "access-tok",
      );

      const messages = (result as Record<string, unknown>).messages as unknown[];
      expect(messages).toHaveLength(1);
    });

    it("searches messages", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              id: "msg2",
              subject: "Report Q4",
              from: { emailAddress: { address: "a@b.com" } },
              receivedDateTime: "2026-01-01T00:00:00Z",
              bodyPreview: "Quarterly...",
            },
          ],
        }),
      );

      const result = await outlookAdapter.executeChatTool!(
        "outlook_search_messages",
        { query: "subject:report" },
        "access-tok",
      );

      const messages = (result as Record<string, unknown>).messages as unknown[];
      expect(messages).toHaveLength(1);
    });

    it("creates a calendar event", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          id: "evt1",
          subject: "Standup",
          start: { dateTime: "2026-02-20T09:00:00" },
          end: { dateTime: "2026-02-20T09:30:00" },
          webLink: "https://outlook.office365.com/owa/?itemid=evt1",
        }, 201),
      );

      const result = await outlookAdapter.executeChatTool!(
        "outlook_create_event",
        {
          subject: "Standup",
          start: "2026-02-20T09:00:00",
          end: "2026-02-20T09:30:00",
          timeZone: "America/New_York",
        },
        "access-tok",
      );

      expect((result as Record<string, unknown>).id).toBe("evt1");
      expect((result as Record<string, unknown>).webLink).toBeDefined();
    });

    it("lists contacts", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              id: "c1",
              displayName: "Jane Doe",
              emailAddresses: [{ address: "jane@example.com" }],
              mobilePhone: "+15551234567",
              companyName: "Acme",
              jobTitle: "VP",
            },
          ],
        }),
      );

      const result = await outlookAdapter.executeChatTool!(
        "outlook_list_contacts",
        { top: 10 },
        "access-tok",
      );

      const contacts = (result as Record<string, unknown>).contacts as unknown[];
      expect(contacts).toHaveLength(1);
    });

    it("returns error for unknown tool", async () => {
      const result = await outlookAdapter.executeChatTool!(
        "outlook_unknown",
        {},
        "access-tok",
      );

      expect((result as Record<string, unknown>).error).toContain("Unknown tool");
    });
  });

  // ---- Base class defaults ----

  it("returns null for getApiKeyFields", () => {
    expect(outlookAdapter.getApiKeyFields()).toBeNull();
  });
});
