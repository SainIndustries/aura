// ---------------------------------------------------------------------------
// Generates files written to the VM during cloud-init for the Google Workspace
// OpenClaw skill.  Includes:
//   1. google-api.js  – Node.js CLI wrapping Gmail & Calendar APIs
//   2. SKILL.md       – OpenClaw skill description
//   3. cred-receiver  – tiny HTTP server for credential injection
// ---------------------------------------------------------------------------

/**
 * Google API CLI tool (runs on the VM).
 *
 * Usage:
 *   node google-api.js mail-list [--query Q] [--max N]
 *   node google-api.js mail-read <messageId>
 *   node google-api.js mail-send --to TO --subject SUBJECT --body BODY
 *   node google-api.js calendar-list [--start ISO] [--end ISO] [--max N]
 *   node google-api.js calendar-create --summary S --start ISO --end ISO [--description D] [--attendees a,b]
 *
 * Reads credentials from /root/.google-creds/tokens.json
 * Auto-refreshes expired access tokens using the stored refresh token.
 */
export function generateGoogleApiJs(): string {
  return `#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CREDS_PATH = "/root/.google-creds/tokens.json";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// ---- credential helpers ----

function readCreds() {
  if (!fs.existsSync(CREDS_PATH)) {
    console.error(JSON.stringify({ error: "Google credentials not configured. Please connect Google in the Aura dashboard." }));
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CREDS_PATH, "utf-8"));
}

function writeCreds(creds) {
  fs.mkdirSync(path.dirname(CREDS_PATH), { recursive: true });
  fs.writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

async function getAccessToken() {
  const creds = readCreds();
  const expiry = new Date(creds.tokenExpiry);
  // Refresh if expired or expiring within 60 seconds
  if (expiry.getTime() - Date.now() < 60_000) {
    if (!creds.refreshToken || !creds.clientId || !creds.clientSecret) {
      console.error(JSON.stringify({ error: "Cannot refresh token — missing refresh token or client credentials." }));
      process.exit(1);
    }
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: creds.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(JSON.stringify({ error: "Token refresh failed: " + text }));
      process.exit(1);
    }
    const data = await res.json();
    creds.accessToken = data.access_token;
    creds.tokenExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
    writeCreds(creds);
  }
  return creds.accessToken;
}

// ---- Google API fetch ----

async function gfetch(url, token, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(init && init.headers),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("Google API " + res.status + ": " + text);
  }
  return res.json();
}

function getHeader(headers, name) {
  const h = (headers || []).find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : "";
}

function decodeBase64Url(data) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, "")
    .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\\s+/g, " ").trim();
}

// ---- CLI argument parser ----

function parseArgs(argv) {
  const args = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] || "";
      i++;
    } else {
      positional.push(argv[i]);
    }
  }
  return { args, positional };
}

// ---- Commands ----

async function mailList(args) {
  const token = await getAccessToken();
  const params = new URLSearchParams({ maxResults: String(args.max || 10) });
  if (args.query) params.set("q", args.query);
  const listRes = await gfetch(GMAIL_API + "/messages?" + params, token);
  const ids = (listRes.messages || []).slice(0, Number(args.max) || 10);
  if (ids.length === 0) return [];
  const emails = await Promise.all(ids.map(async ({ id }) => {
    const msg = await gfetch(
      GMAIL_API + "/messages/" + id + "?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date",
      token
    );
    const h = msg.payload?.headers || [];
    return { id: msg.id, subject: getHeader(h, "Subject") || "(no subject)", from: getHeader(h, "From"), date: getHeader(h, "Date"), snippet: msg.snippet || "" };
  }));
  return emails;
}

async function mailRead(messageId) {
  const token = await getAccessToken();
  const msg = await gfetch(GMAIL_API + "/messages/" + messageId + "?format=full", token);
  const h = msg.payload?.headers || [];
  let body = "";
  const parts = msg.payload?.parts || [];
  const tp = parts.find(p => p.mimeType === "text/plain");
  const hp = parts.find(p => p.mimeType === "text/html");
  if (tp?.body?.data) body = decodeBase64Url(tp.body.data);
  else if (hp?.body?.data) body = stripHtml(decodeBase64Url(hp.body.data));
  else if (msg.payload?.body?.data) body = decodeBase64Url(msg.payload.body.data);
  else body = msg.snippet || "";
  if (body.length > 3000) body = body.slice(0, 3000) + "\\n...(truncated)";
  return { id: msg.id, subject: getHeader(h, "Subject") || "(no subject)", from: getHeader(h, "From"), to: getHeader(h, "To"), date: getHeader(h, "Date"), body };
}

async function mailSend(args) {
  const token = await getAccessToken();
  const raw = ["To: " + args.to, "Subject: " + args.subject, 'Content-Type: text/plain; charset="UTF-8"', "", args.body].join("\\r\\n");
  const encoded = Buffer.from(raw).toString("base64").replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
  const res = await gfetch(GMAIL_API + "/messages/send", token, { method: "POST", body: JSON.stringify({ raw: encoded }) });
  return { success: true, messageId: res.id };
}

async function calendarList(args) {
  const token = await getAccessToken();
  const params = new URLSearchParams({ singleEvents: "true", orderBy: "startTime", maxResults: String(args.max || 10) });
  if (args.start) params.set("timeMin", args.start);
  if (args.end) params.set("timeMax", args.end);
  if (!args.start && !args.end) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    params.set("timeMin", now.toISOString());
  }
  const res = await gfetch(CALENDAR_API + "/calendars/primary/events?" + params, token);
  return (res.items || []).map(ev => ({
    id: ev.id,
    summary: ev.summary || "(no title)",
    start: ev.start?.dateTime || ev.start?.date || "",
    end: ev.end?.dateTime || ev.end?.date || "",
    description: ev.description || "",
    attendees: (ev.attendees || []).map(a => a.email),
    htmlLink: ev.htmlLink || "",
  }));
}

async function calendarCreate(args) {
  const token = await getAccessToken();
  const body = { summary: args.summary, start: { dateTime: args.start }, end: { dateTime: args.end } };
  if (args.description) body.description = args.description;
  if (args.attendees) body.attendees = args.attendees.split(",").map(e => ({ email: e.trim() }));
  const res = await gfetch(CALENDAR_API + "/calendars/primary/events", token, { method: "POST", body: JSON.stringify(body) });
  return { id: res.id, htmlLink: res.htmlLink, summary: res.summary, start: res.start?.dateTime || res.start?.date || "", end: res.end?.dateTime || res.end?.date || "" };
}

// ---- main ----

async function main() {
  const [,, command, ...rest] = process.argv;
  const { args, positional } = parseArgs(rest);
  try {
    let result;
    switch (command) {
      case "mail-list":
        result = await mailList(args);
        break;
      case "mail-read":
        if (!positional[0]) throw new Error("Usage: google-api.js mail-read <messageId>");
        result = await mailRead(positional[0]);
        break;
      case "mail-send":
        if (!args.to || !args.subject || !args.body) throw new Error("Usage: google-api.js mail-send --to TO --subject SUBJECT --body BODY");
        result = await mailSend(args);
        break;
      case "calendar-list":
        result = await calendarList(args);
        break;
      case "calendar-create":
        if (!args.summary || !args.start || !args.end) throw new Error("Usage: google-api.js calendar-create --summary S --start ISO --end ISO");
        result = await calendarCreate(args);
        break;
      default:
        result = { error: "Unknown command: " + command, usage: "Commands: mail-list, mail-read, mail-send, calendar-list, calendar-create" };
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

main();
`;
}

/**
 * SKILL.md for the Google Workspace skill.
 * OpenClaw injects this into the LLM context so it knows how to use the tools.
 */
export function generateSkillMd(): string {
  return `---
name: google-workspace
description: Read, send, and manage Gmail and Google Calendar. Use when the user asks about emails, inbox, scheduling, or calendar events.
---

# Google Workspace

You have access to the user's Gmail inbox and Google Calendar through the \`google-api\` CLI tool.
All commands output JSON. Always use \`--json\` style flags and parse the output.

## Gmail

### List emails
\`\`\`bash
node /root/google-workspace-skill/google-api.js mail-list [--query "GMAIL_SEARCH"] [--max 10]
\`\`\`
- \`--query\`: Gmail search syntax (e.g. \`is:unread\`, \`from:boss@co.com\`, \`subject:invoice\`)
- \`--max\`: Maximum emails to return (default 10)
- Returns: array of \`{ id, subject, from, date, snippet }\`

### Read a specific email
\`\`\`bash
node /root/google-workspace-skill/google-api.js mail-read MESSAGE_ID
\`\`\`
- Use \`mail-list\` first to get message IDs
- Returns: \`{ id, subject, from, to, date, body }\`

### Send an email
\`\`\`bash
node /root/google-workspace-skill/google-api.js mail-send --to "recipient@example.com" --subject "Subject" --body "Email body"
\`\`\`
- **Always confirm with the user before sending**
- Returns: \`{ success: true, messageId }\`

## Google Calendar

### List events
\`\`\`bash
node /root/google-workspace-skill/google-api.js calendar-list [--start ISO_DATETIME] [--end ISO_DATETIME] [--max 10]
\`\`\`
- Defaults to today's events if no time range specified
- Returns: array of \`{ id, summary, start, end, description, attendees, htmlLink }\`

### Create an event
\`\`\`bash
node /root/google-workspace-skill/google-api.js calendar-create --summary "Meeting" --start "2026-03-15T14:00:00Z" --end "2026-03-15T15:00:00Z" [--description "Notes"] [--attendees "a@co.com,b@co.com"]
\`\`\`
- **Always confirm details with the user before creating**
- Returns: \`{ id, htmlLink, summary, start, end }\`

## Notes
- If the tool returns \`"Google credentials not configured"\`, tell the user to connect Google in the Aura dashboard.
- Token refresh is automatic — you don't need to handle expired tokens.
`;
}

/**
 * Credential receiver HTTP service (runs on the VM).
 * Accepts POST /credentials/google with the gateway token for auth.
 * Writes credentials to /root/.google-creds/tokens.json.
 */
export function generateCredReceiverJs(gatewayToken: string): string {
  return `#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 18790;
const GATEWAY_TOKEN = ${JSON.stringify(gatewayToken)};
const CREDS_DIR = "/root/.google-creds";
const CREDS_PATH = path.join(CREDS_DIR, "tokens.json");

const server = http.createServer((req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Credential push endpoint
  if (req.method === "POST" && req.url === "/credentials/google") {
    const auth = req.headers.authorization;
    if (auth !== "Bearer " + GATEWAY_TOKEN) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const creds = JSON.parse(body);
        if (!creds.accessToken || !creds.refreshToken || !creds.clientId || !creds.clientSecret) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing required fields: accessToken, refreshToken, clientId, clientSecret" }));
          return;
        }
        fs.mkdirSync(CREDS_DIR, { recursive: true });
        fs.writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
        console.log("[cred-receiver] Google credentials updated for " + (creds.email || "unknown"));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error("[cred-receiver] Error:", err.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("[cred-receiver] Listening on 127.0.0.1:" + PORT);
});
`;
}
