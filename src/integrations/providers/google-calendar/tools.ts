// ---------------------------------------------------------------------------
// Google Calendar chat tool definitions (OpenAI function-calling format).
//
// These tools are exposed to the LLM when the agent runs in fallback mode
// (Aura-side execution, no VM running). Includes both existing tools
// (list, create) and new tools (get, update, delete, check_availability).
// ---------------------------------------------------------------------------

import type { ChatToolDefinition } from "@/integrations/types";
import {
  listCalendarEvents,
  createCalendarEvent,
  getCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  checkAvailability,
} from "./api";

// ---------- Tool definitions ----------

export const CALENDAR_TOOLS: ChatToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description:
        "List upcoming events from the user's Google Calendar. Returns events sorted by start time.",
      parameters: {
        type: "object",
        properties: {
          time_min: {
            type: "string",
            description:
              "Start of time range (ISO 8601 datetime). Defaults to start of today.",
          },
          time_max: {
            type: "string",
            description:
              "End of time range (ISO 8601 datetime). E.g. end of today, end of week.",
          },
          max_results: {
            type: "number",
            description: "Maximum events to return (default 10, max 25).",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_calendar_event",
      description:
        "Get full details of a specific calendar event by its event ID. Use list_calendar_events first to find event IDs.",
      parameters: {
        type: "object",
        properties: {
          event_id: {
            type: "string",
            description: "The Google Calendar event ID.",
          },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description:
        "Create a new event on the user's Google Calendar. Always confirm details with the user before creating.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Event title.",
          },
          start_date_time: {
            type: "string",
            description:
              "Event start time in ISO 8601 format (e.g. '2026-03-15T14:00:00-05:00').",
          },
          end_date_time: {
            type: "string",
            description:
              "Event end time in ISO 8601 format (e.g. '2026-03-15T15:00:00-05:00').",
          },
          description: {
            type: "string",
            description: "Event description (optional).",
          },
          attendees: {
            type: "array",
            items: { type: "string" },
            description: "List of attendee email addresses (optional).",
          },
        },
        required: ["summary", "start_date_time", "end_date_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_calendar_event",
      description:
        "Update an existing calendar event. Only specify the fields you want to change. Always confirm changes with the user before updating.",
      parameters: {
        type: "object",
        properties: {
          event_id: {
            type: "string",
            description: "The Google Calendar event ID to update.",
          },
          summary: {
            type: "string",
            description: "New event title (optional).",
          },
          start_date_time: {
            type: "string",
            description: "New start time in ISO 8601 format (optional).",
          },
          end_date_time: {
            type: "string",
            description: "New end time in ISO 8601 format (optional).",
          },
          description: {
            type: "string",
            description: "New event description (optional).",
          },
          attendees: {
            type: "array",
            items: { type: "string" },
            description:
              "Updated list of attendee email addresses. Replaces existing attendees (optional).",
          },
          location: {
            type: "string",
            description: "New event location (optional).",
          },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_calendar_event",
      description:
        "Delete a calendar event. Always confirm with the user before deleting.",
      parameters: {
        type: "object",
        properties: {
          event_id: {
            type: "string",
            description: "The Google Calendar event ID to delete.",
          },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check free/busy availability for one or more calendars during a time range. Returns busy time slots. Useful for finding meeting times or checking if someone is available.",
      parameters: {
        type: "object",
        properties: {
          time_min: {
            type: "string",
            description:
              "Start of time range to check (ISO 8601 datetime, e.g. '2026-03-15T09:00:00-05:00').",
          },
          time_max: {
            type: "string",
            description:
              "End of time range to check (ISO 8601 datetime, e.g. '2026-03-15T18:00:00-05:00').",
          },
          calendar_ids: {
            type: "array",
            items: { type: "string" },
            description:
              "Calendar IDs or email addresses to check. Defaults to the user's primary calendar.",
          },
        },
        required: ["time_min", "time_max"],
      },
    },
  },
];

// ---------- Tool executor ----------

export async function executeCalendarTool(
  toolName: string,
  args: Record<string, unknown>,
  accessToken: string,
): Promise<unknown> {
  switch (toolName) {
    case "list_calendar_events":
      return await listCalendarEvents(
        accessToken,
        args.time_min as string | undefined,
        args.time_max as string | undefined,
        Math.min((args.max_results as number) || 10, 25),
      );

    case "get_calendar_event":
      return await getCalendarEvent(
        accessToken,
        args.event_id as string,
      );

    case "create_calendar_event":
      return await createCalendarEvent(accessToken, {
        summary: args.summary as string,
        startDateTime: args.start_date_time as string,
        endDateTime: args.end_date_time as string,
        description: args.description as string | undefined,
        attendees: args.attendees as string[] | undefined,
      });

    case "update_calendar_event":
      return await updateCalendarEvent(
        accessToken,
        args.event_id as string,
        {
          summary: args.summary as string | undefined,
          startDateTime: args.start_date_time as string | undefined,
          endDateTime: args.end_date_time as string | undefined,
          description: args.description as string | undefined,
          attendees: args.attendees as string[] | undefined,
          location: args.location as string | undefined,
        },
      );

    case "delete_calendar_event":
      return await deleteCalendarEvent(
        accessToken,
        args.event_id as string,
      );

    case "check_availability":
      return await checkAvailability(
        accessToken,
        args.time_min as string,
        args.time_max as string,
        (args.calendar_ids as string[]) ?? ["primary"],
      );

    default:
      return { error: `Unknown calendar tool: ${toolName}` };
  }
}
