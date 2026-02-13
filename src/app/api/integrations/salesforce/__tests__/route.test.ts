import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies first
vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/integrations/oauth-state", () => ({
  generateState: vi.fn(),
  validateState: vi.fn(),
}));

vi.mock("@/lib/integrations/encryption", () => ({
  encryptToken: vi.fn((token) => `encrypted_${token}`),
  decryptToken: vi.fn((token) => token.replace("encrypted_", "")),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      integrations: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{ id: "test-id" }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState, validateState } from "@/lib/integrations/oauth-state";

describe("Salesforce OAuth Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("GET /api/integrations/salesforce", () => {
    it("should redirect to sign-in if user is not authenticated", async () => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const { GET } = await import("../route");
      const response = await GET();

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/sign-in");
    });

    it("should redirect to integrations with error if client ID is not configured", async () => {
      vi.stubEnv('SALESFORCE_CLIENT_ID', '');
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
      vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" } as any);

      const { GET } = await import("../route");
      const response = await GET();

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("error=salesforce_not_configured");
    });

    it("should redirect to Salesforce OAuth URL when authenticated", async () => {
      vi.stubEnv('SALESFORCE_CLIENT_ID', 'test-client-id');
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
      vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" } as any);
      vi.mocked(generateState).mockResolvedValue("test-state");

      const { GET } = await import("../route");
      const response = await GET();

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain("login.salesforce.com/services/oauth2/authorize");
      expect(location).toContain("client_id=test-client-id");
      expect(location).toContain("state=test-state");
    });
  });

  describe("GET /api/integrations/salesforce/callback", () => {
    it("should redirect with error if OAuth was denied", async () => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
      
      const { GET: CallbackGET } = await import("../callback/route");
      const request = new Request(
        "http://localhost:3000/api/integrations/salesforce/callback?error=access_denied"
      ) as any;
      request.nextUrl = new URL(request.url);

      const response = await CallbackGET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("error=salesforce_oauth_denied");
    });

    it("should redirect with error if code or state is missing", async () => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
      
      const { GET: CallbackGET } = await import("../callback/route");
      const request = new Request(
        "http://localhost:3000/api/integrations/salesforce/callback"
      ) as any;
      request.nextUrl = new URL(request.url);

      const response = await CallbackGET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("error=invalid_callback");
    });

    it("should redirect with error if state validation fails", async () => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
      vi.mocked(validateState).mockResolvedValue(false);

      const { GET: CallbackGET } = await import("../callback/route");
      const request = new Request(
        "http://localhost:3000/api/integrations/salesforce/callback?code=test-code&state=invalid-state"
      ) as any;
      request.nextUrl = new URL(request.url);

      const response = await CallbackGET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("error=invalid_state");
    });
  });
});
