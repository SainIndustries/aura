import { describe, it, expect, vi, beforeEach } from "vitest";
import { salesforceAdapter } from "@/integrations/providers/salesforce/adapter";
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
    integrationId: "int-789",
    userId: "user-456",
    provider: "salesforce",
    encryptedAccessToken: "enc-access",
    encryptedRefreshToken: "enc-refresh",
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    tokenExpiry: new Date(Date.now() + 7200_000),
    isExpired: false,
    scopes: ["api", "refresh_token", "offline_access"],
    metadata: {
      instanceUrl: "https://na30.salesforce.com",
      orgId: "00Dxx0000001gER",
      userId: "005xx000001Svog",
      email: "user@company.com",
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

describe("SalesforceAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SALESFORCE_CLIENT_ID", "test-consumer-key");
    vi.stubEnv("SALESFORCE_CLIENT_SECRET", "test-consumer-secret");
  });

  // ---- Identity ----

  it("has correct id and display name", () => {
    expect(salesforceAdapter.id).toBe("salesforce");
    expect(salesforceAdapter.displayName).toBe("Salesforce");
    expect(salesforceAdapter.authStrategy).toBe("oauth2");
  });

  // ---- OAuth Config ----

  describe("getOAuthConfig", () => {
    it("returns correct OAuth configuration", () => {
      const config = salesforceAdapter.getOAuthConfig();

      expect(config.authorizationUrl).toBe(
        "https://login.salesforce.com/services/oauth2/authorize",
      );
      expect(config.tokenUrl).toBe(
        "https://login.salesforce.com/services/oauth2/token",
      );
      expect(config.clientIdEnvVar).toBe("SALESFORCE_CLIENT_ID");
      expect(config.clientSecretEnvVar).toBe("SALESFORCE_CLIENT_SECRET");
      expect(config.scopes).toContain("api");
      expect(config.scopes).toContain("refresh_token");
      expect(config.scopes).toContain("offline_access");
      expect(config.requestOfflineAccess).toBe(true);
    });
  });

  // ---- processOAuthTokens ----

  describe("processOAuthTokens", () => {
    it("processes tokens and extracts instance URL from response", async () => {
      // Mock identity URL fetch
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          email: "user@company.com",
          display_name: "Test User",
        }),
      );

      const result = await salesforceAdapter.processOAuthTokens({
        access_token: "sf-access",
        refresh_token: "sf-refresh",
        instance_url: "https://na30.salesforce.com",
        id: "https://login.salesforce.com/id/00Dxx0000001gER/005xx000001Svog",
        token_type: "Bearer",
        issued_at: "1234567890",
      });

      expect(result.accessToken).toBe("sf-access");
      expect(result.refreshToken).toBe("sf-refresh");
      expect(result.tokenExpiry).toBeInstanceOf(Date);
      // Estimated ~2 hours from now
      const twoHoursFromNow = Date.now() + 7200 * 1000;
      expect(result.tokenExpiry!.getTime()).toBeGreaterThan(twoHoursFromNow - 5000);
      expect(result.metadata.instanceUrl).toBe("https://na30.salesforce.com");
      expect(result.metadata.orgId).toBe("00Dxx0000001gER");
      expect(result.metadata.userId).toBe("005xx000001Svog");
      expect(result.metadata.email).toBe("user@company.com");
    });

    it("handles missing identity URL gracefully", async () => {
      const result = await salesforceAdapter.processOAuthTokens({
        access_token: "tok",
        instance_url: "https://na30.salesforce.com",
      });

      expect(result.accessToken).toBe("tok");
      expect(result.metadata.instanceUrl).toBe("https://na30.salesforce.com");
      expect(result.metadata.email).toBeUndefined();
    });
  });

  // ---- validateCredentials ----

  describe("validateCredentials", () => {
    it("returns valid when API responds 200", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse([{ version: "66.0", url: "/services/data/v66.0" }]),
      );

      const result =
        await salesforceAdapter.validateCredentials(makeEnvelope());

      expect(result.valid).toBe(true);
    });

    it("returns invalid when token is expired (401)", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 }),
      );

      const result =
        await salesforceAdapter.validateCredentials(makeEnvelope());

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("expired or revoked");
    });

    it("returns invalid when no access token", async () => {
      const result = await salesforceAdapter.validateCredentials(
        makeEnvelope({ accessToken: null }),
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("No access token");
    });

    it("returns invalid when no instance URL in metadata", async () => {
      const result = await salesforceAdapter.validateCredentials(
        makeEnvelope({ metadata: {} }),
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("No instance URL");
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result =
        await salesforceAdapter.validateCredentials(makeEnvelope());

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Network error");
    });
  });

  // ---- refreshToken ----

  describe("refreshToken", () => {
    it("refreshes token and captures rotated refresh token", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          access_token: "new-access",
          refresh_token: "rotated-refresh",
        }),
      );

      const result = await salesforceAdapter.refreshToken!(makeEnvelope());

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe("new-access");
      expect(result!.tokenExpiry).toBeInstanceOf(Date);
      // Salesforce rotates refresh tokens
      expect(result!.refreshToken).toBe("rotated-refresh");
    });

    it("handles response without rotated refresh token", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ access_token: "new-access" }),
      );

      const result = await salesforceAdapter.refreshToken!(makeEnvelope());

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe("new-access");
      expect(result!.refreshToken).toBeUndefined();
    });

    it("returns null when no refresh token", async () => {
      const result = await salesforceAdapter.refreshToken!(
        makeEnvelope({ refreshToken: null }),
      );

      expect(result).toBeNull();
    });

    it("returns null on refresh failure", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Bad Request", { status: 400 }),
      );

      const result = await salesforceAdapter.refreshToken!(makeEnvelope());

      expect(result).toBeNull();
    });

    it("returns null when env vars are missing", async () => {
      vi.stubEnv("SALESFORCE_CLIENT_ID", "");
      vi.stubEnv("SALESFORCE_CLIENT_SECRET", "");

      const result = await salesforceAdapter.refreshToken!(makeEnvelope());

      expect(result).toBeNull();
    });
  });

  // ---- Chat Tools ----

  describe("getChatTools", () => {
    it("returns Salesforce tool definitions", () => {
      const tools = salesforceAdapter.getChatTools();

      expect(tools.length).toBeGreaterThan(0);
      const toolNames = tools.map((t) => t.function.name);
      expect(toolNames).toContain("salesforce_query");
      expect(toolNames).toContain("salesforce_get_record");
      expect(toolNames).toContain("salesforce_create_record");
      expect(toolNames).toContain("salesforce_update_record");
      expect(toolNames).toContain("salesforce_search");
    });
  });

  // ---- executeChatTool ----

  describe("executeChatTool", () => {
    const instanceUrl = "https://na30.salesforce.com";

    it("executes SOQL query", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ totalSize: 1, records: [{ Id: "003xx", Name: "Test" }] }),
      );

      const result = await salesforceAdapter.executeChatTool!(
        "salesforce_query",
        {
          query: "SELECT Id, Name FROM Contact LIMIT 1",
          _instanceUrl: instanceUrl,
        },
        "tok",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/services/data/v66.0/query?q="),
        expect.any(Object),
      );
      expect((result as Record<string, unknown>).totalSize).toBe(1);
    });

    it("gets a record by ID", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ Id: "003xx", FirstName: "John" }),
      );

      const result = await salesforceAdapter.executeChatTool!(
        "salesforce_get_record",
        {
          objectType: "Contact",
          recordId: "003xx",
          _instanceUrl: instanceUrl,
        },
        "tok",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/sobjects/Contact/003xx"),
        expect.any(Object),
      );
      expect((result as Record<string, unknown>).Id).toBe("003xx");
    });

    it("creates a record", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ id: "003xx-new", success: true }),
      );

      const result = await salesforceAdapter.executeChatTool!(
        "salesforce_create_record",
        {
          objectType: "Contact",
          fields: { FirstName: "Jane", LastName: "Doe" },
          _instanceUrl: instanceUrl,
        },
        "tok",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/sobjects/Contact"),
        expect.objectContaining({ method: "POST" }),
      );
      expect((result as Record<string, unknown>).success).toBe(true);
    });

    it("updates a record (204 No Content)", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      const result = await salesforceAdapter.executeChatTool!(
        "salesforce_update_record",
        {
          objectType: "Contact",
          recordId: "003xx",
          fields: { Phone: "555-0100" },
          _instanceUrl: instanceUrl,
        },
        "tok",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/sobjects/Contact/003xx"),
        expect.objectContaining({ method: "PATCH" }),
      );
      expect((result as Record<string, unknown>).success).toBe(true);
    });

    it("executes SOSL search", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse([{ attributes: { type: "Contact" }, Id: "003xx" }]),
      );

      const result = await salesforceAdapter.executeChatTool!(
        "salesforce_search",
        { searchTerm: "John", _instanceUrl: instanceUrl },
        "tok",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/search?q="),
        expect.any(Object),
      );
    });

    it("returns error when instance URL is missing", async () => {
      const result = await salesforceAdapter.executeChatTool!(
        "salesforce_query",
        { query: "SELECT Id FROM Contact" },
        "tok",
      );

      expect((result as Record<string, unknown>).error).toContain(
        "Missing Salesforce instance URL",
      );
    });

    it("returns error for unknown tool", async () => {
      const result = await salesforceAdapter.executeChatTool!(
        "salesforce_unknown",
        { _instanceUrl: instanceUrl },
        "tok",
      );

      expect((result as Record<string, unknown>).error).toContain("Unknown tool");
    });
  });

  // ---- API key methods return null (OAuth adapter) ----

  it("returns null for getApiKeyFields", () => {
    expect(salesforceAdapter.getApiKeyFields()).toBeNull();
  });
});
