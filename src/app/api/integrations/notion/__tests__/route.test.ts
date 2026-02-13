import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { GET as CallbackGET } from "../callback/route";

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
import { generateState, validateState } from "@/lib/integrations/oauth-state";

describe("Notion OAuth Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOTION_CLIENT_ID = "test-client-id";
    process.env.NOTION_CLIENT_SECRET = "test-client-secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  describe("GET /api/integrations/notion", () => {
    it("should redirect to sign-in if user is not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const response = await GET();

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/sign-in");
    });

    it("should redirect to integrations with error if client ID is not configured", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" } as any);
      delete process.env.NOTION_CLIENT_ID;

      const response = await GET();

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("error=notion_not_configured");
    });

    it("should redirect to Notion OAuth URL when authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" } as any);
      vi.mocked(generateState).mockResolvedValue("test-state");

      const response = await GET();

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain("api.notion.com/v1/oauth/authorize");
      expect(location).toContain("client_id=test-client-id");
      expect(location).toContain("state=test-state");
      expect(location).toContain("owner=user");
    });
  });

  describe("GET /api/integrations/notion/callback", () => {
    it("should redirect with error if OAuth was denied", async () => {
      const request = new Request(
        "http://localhost:3000/api/integrations/notion/callback?error=access_denied"
      ) as any;
      request.nextUrl = new URL(request.url);

      const response = await CallbackGET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("error=notion_oauth_denied");
    });

    it("should redirect with error if code or state is missing", async () => {
      const request = new Request(
        "http://localhost:3000/api/integrations/notion/callback"
      ) as any;
      request.nextUrl = new URL(request.url);

      const response = await CallbackGET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("error=invalid_callback");
    });

    it("should redirect with error if state validation fails", async () => {
      vi.mocked(validateState).mockResolvedValue(false);

      const request = new Request(
        "http://localhost:3000/api/integrations/notion/callback?code=test-code&state=invalid-state"
      ) as any;
      request.nextUrl = new URL(request.url);

      const response = await CallbackGET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("error=invalid_state");
    });
  });
});
