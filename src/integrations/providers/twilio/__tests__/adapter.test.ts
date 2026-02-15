import { describe, it, expect, vi, beforeEach } from "vitest";
import { twilioAdapter } from "@/integrations/providers/twilio/adapter";
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
    integrationId: "int-twilio-1",
    userId: "user-456",
    provider: "twilio",
    encryptedAccessToken: "enc-access",
    encryptedRefreshToken: null,
    accessToken: "test-auth-token-32chars00000000",
    refreshToken: null,
    tokenExpiry: null,
    isExpired: false,
    scopes: [],
    metadata: {
      accountSid: "ACtest00000000000000000000000000ff",
      friendlyName: "Test Account",
      phoneNumbers: ["+15551234567"],
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

describe("TwilioAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- Identity ----

  it("has correct id and display name", () => {
    expect(twilioAdapter.id).toBe("twilio");
    expect(twilioAdapter.displayName).toBe("Twilio");
    expect(twilioAdapter.authStrategy).toBe("api_key");
  });

  // ---- API Key Fields ----

  describe("getApiKeyFields", () => {
    it("returns Account SID and Auth Token fields", () => {
      const fields = twilioAdapter.getApiKeyFields();

      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe("primaryKey");
      expect(fields[0].label).toBe("Account SID");
      expect(fields[0].required).toBe(true);
      expect(fields[0].secret).toBe(false);

      expect(fields[1].name).toBe("secondaryKey");
      expect(fields[1].label).toBe("Auth Token");
      expect(fields[1].required).toBe(true);
      expect(fields[1].secret).toBe(true);
    });
  });

  // ---- validateApiKey ----

  describe("validateApiKey", () => {
    it("validates credentials against Twilio API", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          friendly_name: "My Account",
          type: "Full",
          status: "active",
        }),
      );

      const result = await twilioAdapter.validateApiKey({
        primaryKey: "ACtest00000000000000000000000000ff",
        secondaryKey: "authtoken1234567890123456789012",
      });

      expect(result.valid).toBe(true);
      expect(result.metadata?.accountSid).toBe("ACtest00000000000000000000000000ff");
      expect(result.metadata?.friendlyName).toBe("My Account");
    });

    it("rejects invalid Account SID format", async () => {
      const result = await twilioAdapter.validateApiKey({
        primaryKey: "invalid-sid",
        secondaryKey: "token",
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("AC");
    });

    it("rejects missing credentials", async () => {
      const result = await twilioAdapter.validateApiKey({
        primaryKey: "",
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("required");
    });

    it("returns invalid on 401", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 }),
      );

      const result = await twilioAdapter.validateApiKey({
        primaryKey: "ACtest00000000000000000000000000ff",
        secondaryKey: "wrong-token",
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Invalid");
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await twilioAdapter.validateApiKey({
        primaryKey: "ACtest00000000000000000000000000ff",
        secondaryKey: "token123456789012345678901234",
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Network error");
    });
  });

  // ---- validateCredentials ----

  describe("validateCredentials", () => {
    it("returns valid when API responds 200", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ friendly_name: "Test", status: "active" }),
      );

      const result = await twilioAdapter.validateCredentials(makeEnvelope());

      expect(result.valid).toBe(true);
      expect(result.accountInfo?.friendlyName).toBe("Test");
    });

    it("returns invalid when token is wrong (401)", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 }),
      );

      const result = await twilioAdapter.validateCredentials(makeEnvelope());

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("expired or revoked");
    });

    it("returns invalid when no auth token", async () => {
      const result = await twilioAdapter.validateCredentials(
        makeEnvelope({ accessToken: null }),
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("No auth token");
    });

    it("returns invalid when no Account SID in metadata", async () => {
      const result = await twilioAdapter.validateCredentials(
        makeEnvelope({ metadata: {} }),
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Account SID");
    });
  });

  // ---- refreshToken ----

  describe("refreshToken", () => {
    it("always returns null (API keys don't expire)", async () => {
      const result = await (twilioAdapter as any).refreshToken();

      expect(result).toBeNull();
    });
  });

  // ---- Chat Tools ----

  describe("getChatTools", () => {
    it("returns SMS and voice tool definitions", () => {
      const tools = twilioAdapter.getChatTools();

      expect(tools.length).toBeGreaterThan(0);
      const toolNames = tools.map((t) => t.function.name);
      expect(toolNames).toContain("twilio_send_sms");
      expect(toolNames).toContain("twilio_send_whatsapp");
      expect(toolNames).toContain("twilio_list_messages");
      expect(toolNames).toContain("twilio_make_call");
    });
  });

  // ---- executeChatTool ----

  describe("executeChatTool", () => {
    it("sends an SMS", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          sid: "SM123",
          status: "queued",
          to: "+15551234567",
          from: "+15559876543",
        }),
      );

      const result = await twilioAdapter.executeChatTool!(
        "twilio_send_sms",
        {
          to: "+15551234567",
          from: "+15559876543",
          body: "Hello!",
          _accountSid: "ACtest00000000000000000000000000ff",
        },
        "auth-token",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/Messages.json"),
        expect.objectContaining({ method: "POST" }),
      );
      expect((result as Record<string, unknown>).sid).toBe("SM123");
    });

    it("sends a WhatsApp message with prefixed numbers", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          sid: "SM456",
          status: "queued",
          to: "whatsapp:+15551234567",
          from: "whatsapp:+15559876543",
        }),
      );

      const result = await twilioAdapter.executeChatTool!(
        "twilio_send_whatsapp",
        {
          to: "+15551234567",
          from: "+15559876543",
          body: "WhatsApp hello!",
          _accountSid: "ACtest00000000000000000000000000ff",
        },
        "auth-token",
      );

      expect((result as Record<string, unknown>).sid).toBe("SM456");
    });

    it("lists messages", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          messages: [
            { sid: "SM1", from: "+1", to: "+2", body: "Hi", status: "delivered", direction: "outbound-api", date_sent: "2026-01-01" },
          ],
        }),
      );

      const result = await twilioAdapter.executeChatTool!(
        "twilio_list_messages",
        { limit: 5, _accountSid: "ACtest00000000000000000000000000ff" },
        "auth-token",
      );

      const messages = (result as Record<string, unknown>).messages as unknown[];
      expect(messages).toHaveLength(1);
    });

    it("returns error when Account SID is missing", async () => {
      const result = await twilioAdapter.executeChatTool!(
        "twilio_send_sms",
        { to: "+1", from: "+2", body: "Hi" },
        "auth-token",
      );

      expect((result as Record<string, unknown>).error).toContain("Account SID");
    });

    it("returns error for unknown tool", async () => {
      const result = await twilioAdapter.executeChatTool!(
        "twilio_unknown",
        { _accountSid: "ACtest00000000000000000000000000ff" },
        "auth-token",
      );

      expect((result as Record<string, unknown>).error).toContain("Unknown tool");
    });
  });

  // ---- Base class defaults ----

  it("returns null for getOAuthConfig", () => {
    expect(twilioAdapter.getOAuthConfig()).toBeNull();
  });
});
