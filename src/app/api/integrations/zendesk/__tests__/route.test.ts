import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, DELETE } from "../route";
import { GET as CallbackGET } from "../callback/route";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
    delete: vi.fn(() => ({
      where: vi.fn(),
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
import { db } from "@/lib/db";

describe("Zendesk Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    process.env.ZENDESK_CLIENT_ID = "test-client-id";
    process.env.ZENDESK_CLIENT_SECRET = "test-client-secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  describe("POST /api/integrations/zendesk (API Token)", () => {
    it("should return 401 if user is not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const request = new Request("http://localhost:3000/api/integrations/zendesk", {
        method: "POST",
        body: JSON.stringify({
          subdomain: "test",
          email: "test@example.com",
          apiToken: "token123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 if subdomain is missing", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" } as any);

      const request = new Request("http://localhost:3000/api/integrations/zendesk", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          apiToken: "token123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Subdomain is required");
    });

    it("should return 400 if email is missing", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" } as any);

      const request = new Request("http://localhost:3000/api/integrations/zendesk", {
        method: "POST",
        body: JSON.stringify({
          subdomain: "test",
          apiToken: "token123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Email is required");
    });

    it("should save credentials when valid", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" } as any);
      vi.mocked(db.query.integrations.findFirst).mockResolvedValue(undefined);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            user: {
              id: 123,
              name: "Test User",
              email: "test@example.com",
              role: "admin",
            },
          }),
      });

      const request = new Request("http://localhost:3000/api/integrations/zendesk", {
        method: "POST",
        body: JSON.stringify({
          subdomain: "test",
          email: "test@example.com",
          apiToken: "valid-token",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });
  });

  describe("GET /api/integrations/zendesk/callback", () => {
    it("should redirect with error if OAuth was denied", async () => {
      const request = new Request(
        "http://localhost:3000/api/integrations/zendesk/callback?error=access_denied"
      ) as any;
      request.nextUrl = new URL(request.url);

      const response = await CallbackGET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("error=zendesk_oauth_denied");
    });

    it("should redirect with error if code or state is missing", async () => {
      const request = new Request(
        "http://localhost:3000/api/integrations/zendesk/callback"
      ) as any;
      request.nextUrl = new URL(request.url);

      const response = await CallbackGET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("error=invalid_callback");
    });

    it("should redirect with error if state validation fails", async () => {
      vi.mocked(validateState).mockResolvedValue(false);

      const request = new Request(
        "http://localhost:3000/api/integrations/zendesk/callback?code=test-code&state=invalid-state:test"
      ) as any;
      request.nextUrl = new URL(request.url);

      const response = await CallbackGET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("error=invalid_state");
    });
  });

  describe("DELETE /api/integrations/zendesk", () => {
    it("should delete integration successfully", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" } as any);
      vi.mocked(db.query.integrations.findFirst).mockResolvedValue({
        id: "integration-1",
      } as any);

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
