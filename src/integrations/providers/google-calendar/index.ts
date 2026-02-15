// ---------------------------------------------------------------------------
// Google Calendar integration adapter — barrel export.
// ---------------------------------------------------------------------------

export { googleCalendarAdapter } from "./adapter";
export type { GoogleCalendarMetadata } from "./adapter";

// API functions
export {
  listCalendarEvents,
  createCalendarEvent,
  getCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  checkAvailability,
  listCalendars,
} from "./api";
export type { CalendarEvent, CalendarSummary, FreeBusyResult } from "./api";

// Chat tools
export { CALENDAR_TOOLS, executeCalendarTool } from "./tools";
