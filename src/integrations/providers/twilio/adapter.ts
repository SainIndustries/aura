// ---------------------------------------------------------------------------
// Twilio adapter — API key integration for SMS, voice, and WhatsApp
// messaging.
// ---------------------------------------------------------------------------

import {
  ApiKeyAdapter,
  type ApiKeyConnectionInput,
  type ApiKeyFieldDescriptor,
  type CredentialEnvelope,
  type ValidationResult,
  type ChatToolDefinition,
} from "@/integrations/types";

// ---------------------------------------------------------------------------
// Metadata stored in integrations.metadata JSONB
// ---------------------------------------------------------------------------

export interface TwilioMetadata extends Record<string, unknown> {
  accountSid: string;
  friendlyName?: string;
  /** E.164 phone numbers assigned to this integration. */
  phoneNumbers?: string[];
  /** Account type (Trial or Full). */
  accountType?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function twilioApiBase(accountSid: string): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
}

function twilioAuthHeader(accountSid: string, authToken: string): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

async function twilioFetch(
  accountSid: string,
  authToken: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${twilioApiBase(accountSid)}${path}`, {
    ...options,
    headers: {
      Authorization: twilioAuthHeader(accountSid, authToken),
      "Content-Type": "application/x-www-form-urlencoded",
      ...options.headers,
    },
  });
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

class TwilioAdapter extends ApiKeyAdapter<TwilioMetadata> {
  readonly id = "twilio";
  readonly displayName = "Twilio";

  getApiKeyFields(): ApiKeyFieldDescriptor[] {
    return [
      {
        name: "primaryKey",
        label: "Account SID",
        placeholder: "AC...",
        required: true,
        secret: false,
        helpText: "Found in your Twilio Console dashboard",
      },
      {
        name: "secondaryKey",
        label: "Auth Token",
        placeholder: "32-character auth token",
        required: true,
        secret: true,
        helpText: "Found next to your Account SID in the Console",
      },
    ];
  }

  async validateApiKey(
    input: ApiKeyConnectionInput,
  ): Promise<ValidationResult & { metadata?: TwilioMetadata }> {
    const accountSid = input.primaryKey;
    const authToken = input.secondaryKey;

    if (!accountSid || !authToken) {
      return { valid: false, reason: "Account SID and Auth Token are required" };
    }

    if (!accountSid.startsWith("AC") || accountSid.length !== 34) {
      return { valid: false, reason: "Account SID must start with 'AC' and be 34 characters" };
    }

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
        {
          headers: {
            Authorization: twilioAuthHeader(accountSid, authToken),
          },
        },
      );

      if (res.status === 401) {
        return { valid: false, reason: "Invalid Account SID or Auth Token" };
      }

      if (!res.ok) {
        return { valid: false, reason: `API error: ${res.status}` };
      }

      const account = await res.json();
      return {
        valid: true,
        metadata: {
          accountSid,
          friendlyName: account.friendly_name,
          accountType: account.type,
        },
      };
    } catch (err) {
      return {
        valid: false,
        reason: `Connection failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  }

  async validateCredentials(
    envelope: CredentialEnvelope,
  ): Promise<ValidationResult> {
    if (!envelope.accessToken) {
      return { valid: false, reason: "No auth token stored" };
    }

    const meta = envelope.metadata as TwilioMetadata;
    const accountSid = meta?.accountSid;
    if (!accountSid) {
      return { valid: false, reason: "No Account SID in metadata" };
    }

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
        {
          headers: {
            Authorization: twilioAuthHeader(accountSid, envelope.accessToken),
          },
        },
      );

      if (res.status === 401) {
        return { valid: false, reason: "Auth token expired or revoked" };
      }

      if (!res.ok) {
        return { valid: false, reason: `API error: ${res.status}` };
      }

      const account = await res.json();
      return {
        valid: true,
        accountInfo: {
          friendlyName: account.friendly_name,
          status: account.status,
        },
      };
    } catch (err) {
      return {
        valid: false,
        reason: `Connection failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  }

  getChatTools(): ChatToolDefinition[] {
    return [
      {
        type: "function",
        function: {
          name: "twilio_send_sms",
          description: "Send an SMS message via Twilio",
          parameters: {
            type: "object",
            properties: {
              to: {
                type: "string",
                description: "Recipient phone number in E.164 format (e.g., +15551234567)",
              },
              from: {
                type: "string",
                description: "Your Twilio phone number in E.164 format",
              },
              body: {
                type: "string",
                description: "Message text (max 1600 characters)",
              },
            },
            required: ["to", "from", "body"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "twilio_send_whatsapp",
          description: "Send a WhatsApp message via Twilio",
          parameters: {
            type: "object",
            properties: {
              to: {
                type: "string",
                description: "Recipient phone number in E.164 format",
              },
              from: {
                type: "string",
                description: "Your Twilio WhatsApp number in E.164 format",
              },
              body: {
                type: "string",
                description: "Message text",
              },
            },
            required: ["to", "from", "body"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "twilio_list_messages",
          description:
            "List recent SMS/MMS messages from Twilio",
          parameters: {
            type: "object",
            properties: {
              to: {
                type: "string",
                description: "Filter by recipient number",
              },
              from: {
                type: "string",
                description: "Filter by sender number",
              },
              limit: {
                type: "number",
                description: "Max messages to return (default: 20, max: 100)",
              },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "twilio_make_call",
          description:
            "Initiate an outbound phone call via Twilio",
          parameters: {
            type: "object",
            properties: {
              to: {
                type: "string",
                description: "Recipient phone number in E.164 format",
              },
              from: {
                type: "string",
                description: "Your Twilio phone number in E.164 format",
              },
              twiml: {
                type: "string",
                description:
                  "TwiML instructions for the call (e.g., <Response><Say>Hello</Say></Response>)",
              },
            },
            required: ["to", "from", "twiml"],
          },
        },
      },
    ];
  }

  async executeChatTool(
    toolName: string,
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    // For Twilio, accessToken is the Auth Token; accountSid comes from args
    const accountSid = (args._accountSid as string) ?? "";
    if (!accountSid) {
      return {
        error: "Missing Twilio Account SID. Ensure integration metadata is available.",
      };
    }

    switch (toolName) {
      case "twilio_send_sms":
        return this.sendMessage(accountSid, accessToken, args, false);
      case "twilio_send_whatsapp":
        return this.sendMessage(accountSid, accessToken, args, true);
      case "twilio_list_messages":
        return this.listMessages(accountSid, accessToken, args);
      case "twilio_make_call":
        return this.makeCall(accountSid, accessToken, args);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  // ---- Private helpers ----

  private async sendMessage(
    accountSid: string,
    authToken: string,
    args: Record<string, unknown>,
    isWhatsApp: boolean,
  ): Promise<unknown> {
    const to = isWhatsApp
      ? `whatsapp:${args.to as string}`
      : (args.to as string);
    const from = isWhatsApp
      ? `whatsapp:${args.from as string}`
      : (args.from as string);
    const body = ((args.body as string) ?? "").slice(0, 1600);

    const params = new URLSearchParams({ To: to, From: from, Body: body });

    const res = await twilioFetch(accountSid, authToken, "/Messages.json", {
      method: "POST",
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        error: `Send failed: ${res.status}`,
        details: (err as Record<string, unknown>).message ?? await res.text(),
      };
    }

    const msg = await res.json();
    return {
      sid: msg.sid,
      status: msg.status,
      to: msg.to,
      from: msg.from,
    };
  }

  private async listMessages(
    accountSid: string,
    authToken: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const limit = Math.min(Number(args.limit) || 20, 100);
    const params: Record<string, string> = { PageSize: String(limit) };
    if (args.to) params.To = args.to as string;
    if (args.from) params.From = args.from as string;

    const query = new URLSearchParams(params).toString();
    const res = await twilioFetch(
      accountSid,
      authToken,
      `/Messages.json?${query}`,
    );

    if (!res.ok) {
      return { error: `List failed: ${res.status}` };
    }

    const data = await res.json();
    return {
      messages: (data.messages ?? []).map((m: Record<string, unknown>) => ({
        sid: m.sid,
        from: m.from,
        to: m.to,
        body: m.body,
        status: m.status,
        direction: m.direction,
        date_sent: m.date_sent,
      })),
    };
  }

  private async makeCall(
    accountSid: string,
    authToken: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const params = new URLSearchParams({
      To: args.to as string,
      From: args.from as string,
      Twiml: args.twiml as string,
    });

    const res = await twilioFetch(accountSid, authToken, "/Calls.json", {
      method: "POST",
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        error: `Call failed: ${res.status}`,
        details: (err as Record<string, unknown>).message,
      };
    }

    const call = await res.json();
    return {
      sid: call.sid,
      status: call.status,
      to: call.to,
      from: call.from,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const twilioAdapter = new TwilioAdapter();
