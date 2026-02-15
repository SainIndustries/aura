// Google API service functions for Gmail and Calendar

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// ---------- Types ----------

export interface EmailSummary {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export interface EmailDetail {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  attendees?: string[];
  htmlLink?: string;
}

// ---------- Helpers ----------

function getHeader(
  headers: { name: string; value: string }[],
  name: string
): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf-8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function googleFetch(url: string, accessToken: string, init?: RequestInit) {
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
    throw new Error(`Google API error (${res.status}): ${text}`);
  }
  return res.json();
}

// ---------- Gmail ----------

export async function listEmails(
  accessToken: string,
  query?: string,
  maxResults = 10
): Promise<EmailSummary[]> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
  });
  if (query) params.set("q", query);

  const listRes = await googleFetch(
    `${GMAIL_API}/messages?${params}`,
    accessToken
  );

  const messageIds: { id: string }[] = listRes.messages ?? [];
  if (messageIds.length === 0) return [];

  // Fetch metadata for each message (limited to first maxResults)
  const emails = await Promise.all(
    messageIds.slice(0, maxResults).map(async ({ id }) => {
      const msg = await googleFetch(
        `${GMAIL_API}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        accessToken
      );
      const headers = msg.payload?.headers ?? [];
      return {
        id: msg.id,
        subject: getHeader(headers, "Subject") || "(no subject)",
        from: getHeader(headers, "From"),
        date: getHeader(headers, "Date"),
        snippet: msg.snippet ?? "",
      };
    })
  );

  return emails;
}

export async function readEmail(
  accessToken: string,
  messageId: string
): Promise<EmailDetail> {
  const msg = await googleFetch(
    `${GMAIL_API}/messages/${messageId}?format=full`,
    accessToken
  );

  const headers = msg.payload?.headers ?? [];

  // Extract body — check parts, then payload body
  let body = "";
  const parts = msg.payload?.parts ?? [];

  // Find text/plain first, fall back to text/html
  const textPart = parts.find(
    (p: { mimeType: string }) => p.mimeType === "text/plain"
  );
  const htmlPart = parts.find(
    (p: { mimeType: string }) => p.mimeType === "text/html"
  );

  if (textPart?.body?.data) {
    body = decodeBase64Url(textPart.body.data);
  } else if (htmlPart?.body?.data) {
    body = stripHtml(decodeBase64Url(htmlPart.body.data));
  } else if (msg.payload?.body?.data) {
    body = decodeBase64Url(msg.payload.body.data);
  } else {
    body = msg.snippet ?? "";
  }

  // Truncate very long bodies to keep LLM context manageable
  if (body.length > 3000) {
    body = body.slice(0, 3000) + "\n...(truncated)";
  }

  return {
    id: msg.id,
    subject: getHeader(headers, "Subject") || "(no subject)",
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    date: getHeader(headers, "Date"),
    body,
  };
}

export async function sendEmail(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<{ success: boolean; messageId: string }> {
  // Build RFC 2822 message
  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    body,
  ].join("\r\n");

  // Base64url encode
  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await googleFetch(`${GMAIL_API}/messages/send`, accessToken, {
    method: "POST",
    body: JSON.stringify({ raw: encoded }),
  });

  return { success: true, messageId: res.id };
}

// ---------- Calendar ----------

export async function listCalendarEvents(
  accessToken: string,
  timeMin?: string,
  timeMax?: string,
  maxResults = 10
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(maxResults),
  });

  if (timeMin) params.set("timeMin", timeMin);
  if (timeMax) params.set("timeMax", timeMax);

  // Default to today if no time range specified
  if (!timeMin && !timeMax) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    params.set("timeMin", now.toISOString());
  }

  const res = await googleFetch(
    `${CALENDAR_API}/calendars/primary/events?${params}`,
    accessToken
  );

  return (res.items ?? []).map(
    (ev: {
      id: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      description?: string;
      attendees?: { email: string }[];
      htmlLink?: string;
    }) => ({
      id: ev.id,
      summary: ev.summary ?? "(no title)",
      start: ev.start?.dateTime ?? ev.start?.date ?? "",
      end: ev.end?.dateTime ?? ev.end?.date ?? "",
      description: ev.description,
      attendees: ev.attendees?.map((a) => a.email),
      htmlLink: ev.htmlLink,
    })
  );
}

export async function createCalendarEvent(
  accessToken: string,
  opts: {
    summary: string;
    startDateTime: string;
    endDateTime: string;
    description?: string;
    attendees?: string[];
  }
): Promise<{ id: string; htmlLink: string; summary: string; start: string; end: string }> {
  const eventBody: Record<string, unknown> = {
    summary: opts.summary,
    start: { dateTime: opts.startDateTime },
    end: { dateTime: opts.endDateTime },
  };

  if (opts.description) eventBody.description = opts.description;
  if (opts.attendees?.length) {
    eventBody.attendees = opts.attendees.map((email) => ({ email }));
  }

  const res = await googleFetch(
    `${CALENDAR_API}/calendars/primary/events`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(eventBody),
    }
  );

  return {
    id: res.id,
    htmlLink: res.htmlLink,
    summary: res.summary,
    start: res.start?.dateTime ?? res.start?.date ?? "",
    end: res.end?.dateTime ?? res.end?.date ?? "",
  };
}
