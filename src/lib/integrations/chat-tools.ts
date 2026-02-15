// OpenAI function-calling tool definitions for Google integrations + executor

import {
  listEmails,
  readEmail,
  sendEmail,
  listCalendarEvents,
  createCalendarEvent,
} from "./google-api";

// ---------- Tool definitions (OpenAI function calling format) ----------

export const GOOGLE_TOOLS: {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}[] = [
  {
    type: "function",
    function: {
      name: "list_emails",
      description:
        "List recent emails from the user's Gmail inbox. Can filter by search query (same syntax as Gmail search, e.g. 'is:unread', 'from:boss@company.com', 'subject:invoice').",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Gmail search query to filter emails (optional). Examples: 'is:unread', 'from:john@example.com', 'subject:meeting'.",
          },
          max_results: {
            type: "number",
            description:
              "Maximum number of emails to return (default 10, max 20).",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_email",
      description:
        "Read the full content of a specific email by its message ID. Use list_emails first to get message IDs.",
      parameters: {
        type: "object",
        properties: {
          message_id: {
            type: "string",
            description: "The Gmail message ID to read.",
          },
        },
        required: ["message_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description:
        "Send an email from the user's Gmail account. Always confirm with the user before sending.",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Recipient email address.",
          },
          subject: {
            type: "string",
            description: "Email subject line.",
          },
          body: {
            type: "string",
            description: "Email body text (plain text).",
          },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description:
        "List upcoming events from the user's primary Google Calendar. Returns events sorted by start time.",
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
      name: "create_calendar_event",
      description:
        "Create a new event on the user's primary Google Calendar. Always confirm details with the user before creating.",
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
              "Event start time in ISO 8601 format (e.g. '2025-03-15T14:00:00-05:00').",
          },
          end_date_time: {
            type: "string",
            description:
              "Event end time in ISO 8601 format (e.g. '2025-03-15T15:00:00-05:00').",
          },
          description: {
            type: "string",
            description: "Event description (optional).",
          },
          attendees: {
            type: "array",
            items: { type: "string" },
            description:
              "List of attendee email addresses (optional).",
          },
        },
        required: ["summary", "start_date_time", "end_date_time"],
      },
    },
  },
];

// ---------- Tool executor ----------

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  accessToken: string
): Promise<unknown> {
  try {
    switch (toolName) {
      case "list_emails":
        return await listEmails(
          accessToken,
          args.query as string | undefined,
          Math.min((args.max_results as number) || 10, 20)
        );

      case "read_email":
        return await readEmail(accessToken, args.message_id as string);

      case "send_email":
        return await sendEmail(
          accessToken,
          args.to as string,
          args.subject as string,
          args.body as string
        );

      case "list_calendar_events":
        return await listCalendarEvents(
          accessToken,
          args.time_min as string | undefined,
          args.time_max as string | undefined,
          Math.min((args.max_results as number) || 10, 25)
        );

      case "create_calendar_event":
        return await createCalendarEvent(accessToken, {
          summary: args.summary as string,
          startDateTime: args.start_date_time as string,
          endDateTime: args.end_date_time as string,
          description: args.description as string | undefined,
          attendees: args.attendees as string[] | undefined,
        });

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed";
    console.error(`[chat-tools] ${toolName} failed:`, message);
    return { error: message };
  }
}
