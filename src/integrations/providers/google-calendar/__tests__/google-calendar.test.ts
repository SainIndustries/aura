// ---------------------------------------------------------------------------
// Unit tests for the Google Calendar integration adapter.
// Tests cover: API functions, chat tool executor, adapter methods.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Mock fetch globally ----------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------- Import after mocking ----------

import {
  getCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  checkAvailability,
  listCalendars,
} from "@/integrations/providers/google-calendar/api";
import { executeCalendarTool } from "@/integrations/providers/google-calendar/tools";
import { googleCalendarAdapter } from "@/integrations/providers/google-calendar/adapter";
import type { CredentialEnvelope } from "@/integrations/types";

// ---------- Helpers ----------

function mockFetchResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function mockFetchNoContent() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 204,
    json: () => Promise.resolve(null),
    text: () => Promise.resolve(""),
  });
}

function makeEnvelope(overrides: Partial<CredentialEnvelope> = {}): CredentialEnvelope {
  return {
    integrationId: "int-123",
    userId: "user-456",
    provider: "google",
    encryptedAccessToken: "encrypted-at",
    encryptedRefreshToken: "encrypted-rt",
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    tokenExpiry: new Date(Date.now() + 3600_000),
    isExpired: false,
    scopes: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    metadata: { email: "user@gmail.com", name: "Test User" },
    connectedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ==========================================================================
// API Functions
// ==========================================================================

describe("Google Calendar API", () => {
  describe("getCalendarEvent", () => {
    it("fetches a single event by ID", async () => {
      mockFetchResponse({
        id: "event-1",
        summary: "Team Standup",
        start: { dateTime: "2026-03-15T09:00:00Z" },
        end: { dateTime: "2026-03-15T09:30:00Z" },
        description: "Daily sync",
        attendees: [{ email: "a@co.com" }, { email: "b@co.com" }],
        htmlLink: "https://calendar.google.com/event/1",
        status: "confirmed",
        location: "Room A",
        organizer: { email: "user@gmail.com" },
      });

      const event = await getCalendarEvent("token", "event-1");

      expect(event.id).toBe("event-1");
      expect(event.summary).toBe("Team Standup");
      expect(event.start).toBe("2026-03-15T09:00:00Z");
      expect(event.end).toBe("2026-03-15T09:30:00Z");
      expect(event.attendees).toEqual(["a@co.com", "b@co.com"]);
      expect(event.status).toBe("confirmed");
      expect(event.location).toBe("Room A");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/primary/events/event-1"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer token",
          }),
        }),
      );
    });

    it("uses custom calendar ID when provided", async () => {
      mockFetchResponse({ id: "ev-2", summary: "Work", start: {}, end: {} });

      await getCalendarEvent("token", "ev-2", "work@group.calendar.google.com");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/calendars/work%40group.calendar.google.com/events/ev-2",
        ),
        expect.anything(),
      );
    });

    it("handles missing summary", async () => {
      mockFetchResponse({ id: "ev-3", start: {}, end: {} });

      const event = await getCalendarEvent("token", "ev-3");

      expect(event.summary).toBe("(no title)");
    });
  });

  describe("updateCalendarEvent", () => {
    it("sends PATCH with only changed fields", async () => {
      mockFetchResponse({
        id: "event-1",
        htmlLink: "https://calendar.google.com/event/1",
        summary: "Updated Title",
        start: { dateTime: "2026-03-15T10:00:00Z" },
        end: { dateTime: "2026-03-15T11:00:00Z" },
      });

      const result = await updateCalendarEvent("token", "event-1", {
        summary: "Updated Title",
        location: "Room B",
      });

      expect(result.summary).toBe("Updated Title");

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/calendars/primary/events/event-1");
      expect(opts.method).toBe("PATCH");

      const body = JSON.parse(opts.body);
      expect(body.summary).toBe("Updated Title");
      expect(body.location).toBe("Room B");
      // Should NOT include fields not specified
      expect(body.start).toBeUndefined();
      expect(body.end).toBeUndefined();
    });

    it("sends attendees as email objects", async () => {
      mockFetchResponse({
        id: "event-1",
        htmlLink: "link",
        summary: "Meeting",
        start: { dateTime: "2026-03-15T10:00:00Z" },
        end: { dateTime: "2026-03-15T11:00:00Z" },
      });

      await updateCalendarEvent("token", "event-1", {
        attendees: ["a@co.com", "b@co.com"],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.attendees).toEqual([
        { email: "a@co.com" },
        { email: "b@co.com" },
      ]);
    });
  });

  describe("deleteCalendarEvent", () => {
    it("sends DELETE and returns success", async () => {
      mockFetchNoContent();

      const result = await deleteCalendarEvent("token", "event-1");

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/primary/events/event-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("checkAvailability", () => {
    it("queries freebusy endpoint and returns busy slots", async () => {
      mockFetchResponse({
        calendars: {
          primary: {
            busy: [
              {
                start: "2026-03-15T10:00:00Z",
                end: "2026-03-15T11:00:00Z",
              },
              {
                start: "2026-03-15T14:00:00Z",
                end: "2026-03-15T15:00:00Z",
              },
            ],
          },
        },
      });

      const results = await checkAvailability(
        "token",
        "2026-03-15T09:00:00Z",
        "2026-03-15T18:00:00Z",
      );

      expect(results).toHaveLength(1);
      expect(results[0].calendarId).toBe("primary");
      expect(results[0].busy).toHaveLength(2);
      expect(results[0].busy[0].start).toBe("2026-03-15T10:00:00Z");
    });

    it("supports multiple calendar IDs", async () => {
      mockFetchResponse({
        calendars: {
          primary: { busy: [] },
          "other@co.com": {
            busy: [
              { start: "2026-03-15T12:00:00Z", end: "2026-03-15T13:00:00Z" },
            ],
          },
        },
      });

      const results = await checkAvailability(
        "token",
        "2026-03-15T09:00:00Z",
        "2026-03-15T18:00:00Z",
        ["primary", "other@co.com"],
      );

      expect(results).toHaveLength(2);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.items).toEqual([
        { id: "primary" },
        { id: "other@co.com" },
      ]);
    });
  });

  describe("listCalendars", () => {
    it("returns all calendars on the user's list", async () => {
      mockFetchResponse({
        items: [
          {
            id: "primary",
            summary: "My Calendar",
            primary: true,
            backgroundColor: "#4285F4",
            accessRole: "owner",
          },
          {
            id: "work@group.calendar.google.com",
            summary: "Work Calendar",
            description: "Team shared calendar",
            accessRole: "writer",
          },
        ],
      });

      const calendars = await listCalendars("token");

      expect(calendars).toHaveLength(2);
      expect(calendars[0].id).toBe("primary");
      expect(calendars[0].primary).toBe(true);
      expect(calendars[1].summary).toBe("Work Calendar");
      expect(calendars[1].accessRole).toBe("writer");
    });
  });
});

// ==========================================================================
// Chat Tool Executor
// ==========================================================================

describe("Calendar Tool Executor", () => {
  it("routes get_calendar_event correctly", async () => {
    mockFetchResponse({
      id: "ev-1",
      summary: "Meeting",
      start: { dateTime: "2026-03-15T10:00:00Z" },
      end: { dateTime: "2026-03-15T11:00:00Z" },
    });

    const result = await executeCalendarTool(
      "get_calendar_event",
      { event_id: "ev-1" },
      "token",
    );

    expect(result).toHaveProperty("id", "ev-1");
  });

  it("routes update_calendar_event correctly", async () => {
    mockFetchResponse({
      id: "ev-1",
      htmlLink: "link",
      summary: "New Title",
      start: { dateTime: "2026-03-15T10:00:00Z" },
      end: { dateTime: "2026-03-15T11:00:00Z" },
    });

    const result = await executeCalendarTool(
      "update_calendar_event",
      { event_id: "ev-1", summary: "New Title" },
      "token",
    );

    expect(result).toHaveProperty("summary", "New Title");
  });

  it("routes delete_calendar_event correctly", async () => {
    mockFetchNoContent();

    const result = await executeCalendarTool(
      "delete_calendar_event",
      { event_id: "ev-1" },
      "token",
    );

    expect(result).toHaveProperty("success", true);
  });

  it("routes check_availability correctly", async () => {
    mockFetchResponse({
      calendars: {
        primary: {
          busy: [
            { start: "2026-03-15T10:00:00Z", end: "2026-03-15T11:00:00Z" },
          ],
        },
      },
    });

    const result = (await executeCalendarTool(
      "check_availability",
      {
        time_min: "2026-03-15T09:00:00Z",
        time_max: "2026-03-15T18:00:00Z",
      },
      "token",
    )) as Array<{ busy: unknown[] }>;

    expect(result).toHaveLength(1);
    expect(result[0].busy).toHaveLength(1);
  });

  it("returns error for unknown tool", async () => {
    const result = await executeCalendarTool("unknown_tool", {}, "token");

    expect(result).toHaveProperty("error");
  });
});

// ==========================================================================
// Adapter Interface
// ==========================================================================

describe("GoogleCalendarAdapter", () => {
  describe("identity", () => {
    it('has id "google"', () => {
      expect(googleCalendarAdapter.id).toBe("google");
    });

    it("has displayName", () => {
      expect(googleCalendarAdapter.displayName).toBe("Google Calendar");
    });

    it('has authStrategy "oauth2"', () => {
      expect(googleCalendarAdapter.authStrategy).toBe("oauth2");
    });
  });

  describe("getOAuthConfig", () => {
    it("returns valid Google OAuth config", () => {
      const config = googleCalendarAdapter.getOAuthConfig();

      expect(config.authorizationUrl).toContain("accounts.google.com");
      expect(config.tokenUrl).toContain("googleapis.com/token");
      expect(config.clientIdEnvVar).toBe("GOOGLE_CLIENT_ID");
      expect(config.clientSecretEnvVar).toBe("GOOGLE_CLIENT_SECRET");
      expect(config.requestOfflineAccess).toBe(true);
      expect(config.forceConsent).toBe(true);
      expect(config.scopeDelimiter).toBe(" ");
    });

    it("includes calendar scopes", () => {
      const config = googleCalendarAdapter.getOAuthConfig();
      const calendarScopes = config.scopes.filter((s) =>
        s.includes("calendar"),
      );

      expect(calendarScopes.length).toBeGreaterThanOrEqual(2);
      expect(config.scopes).toContain(
        "https://www.googleapis.com/auth/calendar.readonly",
      );
      expect(config.scopes).toContain(
        "https://www.googleapis.com/auth/calendar.events",
      );
    });
  });

  describe("getApiKeyFields", () => {
    it("returns null (OAuth adapter)", () => {
      expect(googleCalendarAdapter.getApiKeyFields()).toBeNull();
    });
  });

  describe("validateCredentials", () => {
    it("returns invalid when no access token", async () => {
      const envelope = makeEnvelope({ accessToken: null });

      const result = await googleCalendarAdapter.validateCredentials(envelope);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("No access token");
    });

    it("returns invalid when token is expired", async () => {
      const envelope = makeEnvelope({ isExpired: true });

      const result = await googleCalendarAdapter.validateCredentials(envelope);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("expired");
    });

    it("returns valid when API call succeeds", async () => {
      mockFetchResponse({ items: [] }); // listCalendarEvents response

      const envelope = makeEnvelope();
      const result = await googleCalendarAdapter.validateCredentials(envelope);

      expect(result.valid).toBe(true);
    });

    it("returns invalid when API call fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      const envelope = makeEnvelope();
      const result = await googleCalendarAdapter.validateCredentials(envelope);

      expect(result.valid).toBe(false);
    });
  });

  describe("refreshToken", () => {
    beforeEach(() => {
      vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
      vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
    });

    it("returns null when no refresh token", async () => {
      const envelope = makeEnvelope({ refreshToken: null });

      const result = await googleCalendarAdapter.refreshToken!(envelope);

      expect(result).toBeNull();
    });

    it("refreshes token successfully", async () => {
      mockFetchResponse({
        access_token: "new-access-token",
        expires_in: 3600,
      });

      const envelope = makeEnvelope();
      const result = await googleCalendarAdapter.refreshToken!(envelope);

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe("new-access-token");
      expect(result!.tokenExpiry).toBeInstanceOf(Date);
      // Google does not rotate refresh tokens
      expect(result!.refreshToken).toBeUndefined();
    });

    it("returns null on refresh failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request"),
      });

      const envelope = makeEnvelope();
      const result = await googleCalendarAdapter.refreshToken!(envelope);

      expect(result).toBeNull();
    });
  });

  describe("getChatTools", () => {
    it("returns calendar tool definitions", () => {
      const tools = googleCalendarAdapter.getChatTools();

      expect(tools.length).toBeGreaterThanOrEqual(6);

      const names = tools.map((t) => t.function.name);
      expect(names).toContain("list_calendar_events");
      expect(names).toContain("create_calendar_event");
      expect(names).toContain("get_calendar_event");
      expect(names).toContain("update_calendar_event");
      expect(names).toContain("delete_calendar_event");
      expect(names).toContain("check_availability");
    });

    it("all tools have type function", () => {
      const tools = googleCalendarAdapter.getChatTools();
      for (const tool of tools) {
        expect(tool.type).toBe("function");
      }
    });
  });

  describe("getVmSkillManifest", () => {
    it("returns a manifest with correct skill directory", () => {
      const manifest = googleCalendarAdapter.getVmSkillManifest!(
        "test-gateway-token",
      );

      expect(manifest).not.toBeNull();
      expect(manifest!.skillDirName).toBe("google-workspace-skill");
    });

    it("includes SKILL.md with calendar commands", () => {
      const manifest = googleCalendarAdapter.getVmSkillManifest!(
        "test-gateway-token",
      );

      const skillMd = manifest!.writeFiles.find((f) =>
        f.path.endsWith("SKILL.md"),
      );
      expect(skillMd).toBeDefined();
      expect(skillMd!.content).toContain("calendar-list");
      expect(skillMd!.content).toContain("calendar-create");
      expect(skillMd!.content).toContain("calendar-get");
      expect(skillMd!.content).toContain("calendar-update");
      expect(skillMd!.content).toContain("calendar-delete");
      expect(skillMd!.content).toContain("calendar-freebusy");
    });

    it("includes Caddy route for credential receiver", () => {
      const manifest = googleCalendarAdapter.getVmSkillManifest!(
        "test-gateway-token",
      );

      expect(manifest!.caddyRoutes).toHaveLength(1);
      expect(manifest!.caddyRoutes[0].matchPath).toBe(
        "/internal/google-credentials",
      );
      expect(manifest!.caddyRoutes[0].upstreamPort).toBe(18790);
    });
  });

  describe("buildVmCredentialPayload", () => {
    beforeEach(() => {
      vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
      vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
    });

    it("builds payload with decrypted credentials", async () => {
      const envelope = makeEnvelope();

      const payload =
        await googleCalendarAdapter.buildVmCredentialPayload!(envelope);

      expect(payload).not.toBeNull();
      expect(payload!.provider).toBe("google");
      expect(payload!.data.accessToken).toBe("test-access-token");
      expect(payload!.data.refreshToken).toBe("test-refresh-token");
      expect(payload!.data.email).toBe("user@gmail.com");
      expect(payload!.data.clientId).toBe("test-client-id");
      expect(payload!.data.clientSecret).toBe("test-client-secret");
    });

    it("returns null when no access token", async () => {
      const envelope = makeEnvelope({ accessToken: null });

      const payload =
        await googleCalendarAdapter.buildVmCredentialPayload!(envelope);

      expect(payload).toBeNull();
    });

    it("returns null when no refresh token", async () => {
      const envelope = makeEnvelope({ refreshToken: null });

      const payload =
        await googleCalendarAdapter.buildVmCredentialPayload!(envelope);

      expect(payload).toBeNull();
    });
  });

  describe("processOAuthTokens", () => {
    it("extracts tokens and fetches user info", async () => {
      // Mock user info fetch
      mockFetchResponse({
        email: "user@gmail.com",
        name: "Test User",
        picture: "https://lh3.googleusercontent.com/photo",
      });

      const result = await googleCalendarAdapter.processOAuthTokens({
        access_token: "new-token",
        refresh_token: "new-refresh",
        expires_in: 3600,
        scope:
          "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
      });

      expect(result.accessToken).toBe("new-token");
      expect(result.refreshToken).toBe("new-refresh");
      expect(result.tokenExpiry).toBeInstanceOf(Date);
      expect(result.scopes).toHaveLength(2);
      expect(result.metadata.email).toBe("user@gmail.com");
      expect(result.metadata.name).toBe("Test User");
    });

    it("handles missing user info gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });

      const result = await googleCalendarAdapter.processOAuthTokens({
        access_token: "token",
        expires_in: 3600,
      });

      expect(result.accessToken).toBe("token");
      expect(result.metadata.email).toBe("");
    });
  });
});
