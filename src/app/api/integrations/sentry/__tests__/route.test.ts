import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, DELETE } from "../route";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock dependencies
vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: vi.fn(),
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

import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";

describe("Sentry API Key Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("GET /api/integrations/sentry", () => {
    it("should return 401 if user is not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return connected: false if no integration exists", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" } as any);
      vi.mocked(db.query.integrations.findFirst).mockResolvedValue(undefined);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connected).toBe(false);
      expect(data.provider).toBe("sentry");
    });
  });

  describe("POST /api/integrations/sentry", () => {
    it("should return 400 if auth token is missing", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" } as any);

      const request = new Request("http://localhost:3000/api/integrations/sentry", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Auth Token is required");
    });

    it("should save credentials when valid", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" } as any);
      vi.mocked(db.query.integrations.findFirst).mockResolvedValue(undefined);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              user: {
                id: "user-123",
                name: "Test User",
                email: "test@example.com",
                avatarUrl: "https://example.com/avatar.png",
                isSuperuser: false,
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: "org-1", name: "Test Org", slug: "test-org" },
            ]),
        });

      const request = new Request("http://localhost:3000/api/integrations/sentry", {
        method: "POST",
        body: JSON.stringify({ authToken: "valid-auth-token" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });
  });

  describe("DELETE /api/integrations/sentry", () => {
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
