import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store original env
const originalEnv = { ...process.env };

// Mock dependencies
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
import { validateState } from "@/lib/integrations/oauth-state";

describe("Salesforce OAuth Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SALESFORCE_CLIENT_ID = "test-client-id";
    process.env.SALESFORCE_CLIENT_SECRET = "test-client-secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("GET /api/integrations/salesforce", () => {
    it("should redirect to sign-in if user is not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      
      const { GET } = await import("../route");
      const response = await GET();

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/sign-in");
    });
  });

  describe("GET /api/integrations/salesforce/callback", () => {
    it("should redirect with error if OAuth was denied", async () => {
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
