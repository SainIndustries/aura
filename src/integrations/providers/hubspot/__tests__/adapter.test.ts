import { describe, it, expect, vi, beforeEach } from "vitest";
import { hubspotAdapter } from "@/integrations/providers/hubspot/adapter";
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
    integrationId: "int-123",
    userId: "user-456",
    provider: "hubspot",
    encryptedAccessToken: "enc-access",
    encryptedRefreshToken: "enc-refresh",
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    tokenExpiry: new Date(Date.now() + 1800_000),
    isExpired: false,
    scopes: ["crm.objects.contacts.read"],
    metadata: { portalId: "12345", hubDomain: "app.hubspot.com" },
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

describe("HubSpotAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("HUBSPOT_CLIENT_ID", "test-client-id");
    vi.stubEnv("HUBSPOT_CLIENT_SECRET", "test-client-secret");
  });

  // ---- Identity ----

  it("has correct id and display name", () => {
    expect(hubspotAdapter.id).toBe("hubspot");
    expect(hubspotAdapter.displayName).toBe("HubSpot");
    expect(hubspotAdapter.authStrategy).toBe("oauth2");
  });

  // ---- OAuth Config ----

  describe("getOAuthConfig", () => {
    it("returns correct OAuth configuration", () => {
      const config = hubspotAdapter.getOAuthConfig();

      expect(config.authorizationUrl).toBe(
        "https://app.hubspot.com/oauth/authorize",
      );
      expect(config.tokenUrl).toBe("https://api.hubapi.com/oauth/v1/token");
      expect(config.clientIdEnvVar).toBe("HUBSPOT_CLIENT_ID");
      expect(config.clientSecretEnvVar).toBe("HUBSPOT_CLIENT_SECRET");
      expect(config.scopes).toContain("crm.objects.contacts.read");
      expect(config.scopes).toContain("crm.objects.deals.write");
      expect(config.scopes).toContain("crm.associations.read");
      expect(config.requestOfflineAccess).toBe(true);
    });
  });

  // ---- processOAuthTokens ----

  describe("processOAuthTokens", () => {
    it("processes tokens and fetches account info", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          portalId: 99999,
          uiDomain: "app.hubspot.com",
          timeZone: "US/Eastern",
          currency: "USD",
        }),
      );

      const result = await hubspotAdapter.processOAuthTokens({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 1800,
        scope: "crm.objects.contacts.read crm.objects.deals.read",
      });

      expect(result.accessToken).toBe("new-access");
      expect(result.refreshToken).toBe("new-refresh");
      expect(result.tokenExpiry).toBeInstanceOf(Date);
      expect(result.scopes).toContain("crm.objects.contacts.read");
      expect(result.metadata.portalId).toBe("99999");
      expect(result.metadata.hubDomain).toBe("app.hubspot.com");
    });

    it("handles account info fetch failure gracefully", async () => {
      mockFetch.mockResolvedValueOnce(new Response("error", { status: 500 }));

      const result = await hubspotAdapter.processOAuthTokens({
        access_token: "tok",
        expires_in: 1800,
      });

      expect(result.accessToken).toBe("tok");
      expect(result.metadata.portalId).toBe("");
    });
  });

  // ---- validateCredentials ----

  describe("validateCredentials", () => {
    it("returns valid when API responds 200", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ portalId: 12345, uiDomain: "app.hubspot.com" }),
      );

      const result = await hubspotAdapter.validateCredentials(makeEnvelope());

      expect(result.valid).toBe(true);
      expect(result.accountInfo?.portalId).toBe(12345);
    });

    it("returns invalid when token is expired (401)", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 }),
      );

      const result = await hubspotAdapter.validateCredentials(makeEnvelope());

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("expired or revoked");
    });

    it("returns invalid when no access token", async () => {
      const result = await hubspotAdapter.validateCredentials(
        makeEnvelope({ accessToken: null }),
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("No access token");
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await hubspotAdapter.validateCredentials(makeEnvelope());

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
          refresh_token: "same-refresh",
          expires_in: 1800,
        }),
      );

      const result = await hubspotAdapter.refreshToken!(makeEnvelope());

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe("refreshed-access");
      expect(result!.tokenExpiry).toBeInstanceOf(Date);
      // HubSpot does NOT rotate refresh tokens
      expect(result!.refreshToken).toBeUndefined();
    });

    it("returns null when no refresh token", async () => {
      const result = await hubspotAdapter.refreshToken!(
        makeEnvelope({ refreshToken: null }),
      );

      expect(result).toBeNull();
    });

    it("returns null on refresh failure", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Bad Request", { status: 400 }),
      );

      const result = await hubspotAdapter.refreshToken!(makeEnvelope());

      expect(result).toBeNull();
    });

    it("returns null when env vars are missing", async () => {
      vi.stubEnv("HUBSPOT_CLIENT_ID", "");
      vi.stubEnv("HUBSPOT_CLIENT_SECRET", "");

      const result = await hubspotAdapter.refreshToken!(makeEnvelope());

      expect(result).toBeNull();
    });
  });

  // ---- Chat Tools ----

  describe("getChatTools", () => {
    it("returns CRM tool definitions", () => {
      const tools = hubspotAdapter.getChatTools();

      expect(tools.length).toBeGreaterThan(0);
      const toolNames = tools.map((t) => t.function.name);
      expect(toolNames).toContain("hubspot_search_contacts");
      expect(toolNames).toContain("hubspot_get_contact");
      expect(toolNames).toContain("hubspot_create_contact");
      expect(toolNames).toContain("hubspot_search_deals");
      expect(toolNames).toContain("hubspot_create_deal");
      expect(toolNames).toContain("hubspot_search_companies");
      expect(toolNames).toContain("hubspot_create_note");
    });
  });

  // ---- executeChatTool ----

  describe("executeChatTool", () => {
    it("searches contacts via POST search endpoint", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ total: 1, results: [{ id: "1", properties: { email: "a@b.com" } }] }),
      );

      const result = await hubspotAdapter.executeChatTool!(
        "hubspot_search_contacts",
        { query: "john" },
        "tok",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.hubapi.com/crm/v3/objects/contacts/search",
        expect.objectContaining({ method: "POST" }),
      );
      expect((result as Record<string, unknown>).total).toBe(1);
    });

    it("gets a contact by ID", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ id: "42", properties: { email: "a@b.com" } }),
      );

      const result = await hubspotAdapter.executeChatTool!(
        "hubspot_get_contact",
        { contactId: "42" },
        "tok",
      );

      expect((result as Record<string, unknown>).id).toBe("42");
    });

    it("creates a contact", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ id: "new-1", properties: { email: "new@test.com" } }),
      );

      const result = await hubspotAdapter.executeChatTool!(
        "hubspot_create_contact",
        { email: "new@test.com", firstname: "New" },
        "tok",
      );

      expect((result as Record<string, unknown>).id).toBe("new-1");
    });

    it("returns error for unknown tool", async () => {
      const result = await hubspotAdapter.executeChatTool!(
        "hubspot_unknown",
        {},
        "tok",
      );

      expect((result as Record<string, unknown>).error).toContain("Unknown tool");
    });
  });

  // ---- API key methods return null (OAuth adapter) ----

  it("returns null for getApiKeyFields", () => {
    expect(hubspotAdapter.getApiKeyFields()).toBeNull();
  });
});
