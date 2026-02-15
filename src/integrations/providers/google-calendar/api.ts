// ---------------------------------------------------------------------------
// Google Calendar API functions.
//
// Extends the existing list/create functions in src/lib/integrations/google-api.ts
// with update, delete, get, freebusy, and listCalendars operations.
// ---------------------------------------------------------------------------

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// Re-export existing types from the shared module
export type { CalendarEvent } from "@/lib/integrations/google-api";

// Re-export existing functions so consumers can import everything from here
export {
  listCalendarEvents,
  createCalendarEvent,
} from "@/lib/integrations/google-api";

// ---------- Types ----------

export interface CalendarSummary {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  accessRole: string;
}

export interface FreeBusySlot {
  start: string;
  end: string;
}

export interface FreeBusyResult {
  calendarId: string;
  busy: FreeBusySlot[];
}

// ---------- Helpers ----------

async function calendarFetch(
  url: string,
  accessToken: string,
  init?: RequestInit,
) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar API error (${res.status}): ${text}`);
  }
  // DELETE returns 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// ---------- New Calendar Operations ----------

/**
 * Get a single calendar event by ID.
 */
export async function getCalendarEvent(
  accessToken: string,
  eventId: string,
  calendarId = "primary",
): Promise<{
  id: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  attendees?: string[];
  htmlLink?: string;
  status?: string;
  location?: string;
  organizer?: { email: string };
}> {
  const res = await calendarFetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken,
  );

  return {
    id: res.id,
    summary: res.summary ?? "(no title)",
    start: res.start?.dateTime ?? res.start?.date ?? "",
    end: res.end?.dateTime ?? res.end?.date ?? "",
    description: res.description,
    attendees: res.attendees?.map((a: { email: string }) => a.email),
    htmlLink: res.htmlLink,
    status: res.status,
    location: res.location,
    organizer: res.organizer ? { email: res.organizer.email } : undefined,
  };
}

/**
 * Update an existing calendar event (partial update via PATCH).
 */
export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  opts: {
    summary?: string;
    startDateTime?: string;
    endDateTime?: string;
    description?: string;
    attendees?: string[];
    location?: string;
  },
  calendarId = "primary",
): Promise<{
  id: string;
  htmlLink: string;
  summary: string;
  start: string;
  end: string;
}> {
  const patchBody: Record<string, unknown> = {};

  if (opts.summary !== undefined) patchBody.summary = opts.summary;
  if (opts.description !== undefined) patchBody.description = opts.description;
  if (opts.location !== undefined) patchBody.location = opts.location;
  if (opts.startDateTime) patchBody.start = { dateTime: opts.startDateTime };
  if (opts.endDateTime) patchBody.end = { dateTime: opts.endDateTime };
  if (opts.attendees) {
    patchBody.attendees = opts.attendees.map((email) => ({ email }));
  }

  const res = await calendarFetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    {
      method: "PATCH",
      body: JSON.stringify(patchBody),
    },
  );

  return {
    id: res.id,
    htmlLink: res.htmlLink,
    summary: res.summary,
    start: res.start?.dateTime ?? res.start?.date ?? "",
    end: res.end?.dateTime ?? res.end?.date ?? "",
  };
}

/**
 * Delete a calendar event.
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string,
  calendarId = "primary",
): Promise<{ success: boolean }> {
  await calendarFetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    { method: "DELETE" },
  );

  return { success: true };
}

/**
 * Check free/busy availability across one or more calendars.
 */
export async function checkAvailability(
  accessToken: string,
  timeMin: string,
  timeMax: string,
  calendarIds: string[] = ["primary"],
): Promise<FreeBusyResult[]> {
  const res = await calendarFetch(
    `${CALENDAR_API}/freeBusy`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: calendarIds.map((id) => ({ id })),
      }),
    },
  );

  const calendars = res.calendars ?? {};
  return Object.entries(calendars).map(
    ([calendarId, data]: [string, unknown]) => ({
      calendarId,
      busy: ((data as { busy?: FreeBusySlot[] }).busy ?? []).map(
        (slot: FreeBusySlot) => ({
          start: slot.start,
          end: slot.end,
        }),
      ),
    }),
  );
}

/**
 * List all calendars on the user's calendar list.
 */
export async function listCalendars(
  accessToken: string,
): Promise<CalendarSummary[]> {
  const res = await calendarFetch(
    `${CALENDAR_API}/users/me/calendarList`,
    accessToken,
  );

  return (res.items ?? []).map(
    (cal: {
      id: string;
      summary?: string;
      description?: string;
      primary?: boolean;
      backgroundColor?: string;
      accessRole?: string;
    }) => ({
      id: cal.id,
      summary: cal.summary ?? "(untitled)",
      description: cal.description,
      primary: cal.primary ?? false,
      backgroundColor: cal.backgroundColor,
      accessRole: cal.accessRole ?? "reader",
    }),
  );
}
