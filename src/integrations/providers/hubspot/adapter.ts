// ---------------------------------------------------------------------------
// HubSpot CRM adapter — OAuth 2.0 integration for contacts, deals,
// companies, tasks, and notes.
// ---------------------------------------------------------------------------

import {
  OAuthAdapter,
  type OAuthConfig,
  type CredentialEnvelope,
  type ValidationResult,
  type TokenRefreshResult,
  type ChatToolDefinition,
} from "@/integrations/types";

// ---------------------------------------------------------------------------
// Metadata stored in integrations.metadata JSONB
// ---------------------------------------------------------------------------

export interface HubSpotMetadata extends Record<string, unknown> {
  portalId: string;
  hubDomain: string;
  userEmail?: string;
  timeZone?: string;
  currency?: string;
}

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

const HUBSPOT_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.tasks.read",
  "crm.objects.tasks.write",
  "crm.objects.notes.read",
  "crm.objects.notes.write",
  "crm.associations.read",
  "crm.associations.write",
];

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const HUBSPOT_API_BASE = "https://api.hubapi.com";

async function hubspotFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${HUBSPOT_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

class HubSpotAdapter extends OAuthAdapter<HubSpotMetadata> {
  readonly id = "hubspot";
  readonly displayName = "HubSpot";

  getOAuthConfig(): OAuthConfig {
    return {
      authorizationUrl: "https://app.hubspot.com/oauth/authorize",
      tokenUrl: "https://api.hubapi.com/oauth/v1/token",
      clientIdEnvVar: "HUBSPOT_CLIENT_ID",
      clientSecretEnvVar: "HUBSPOT_CLIENT_SECRET",
      scopes: HUBSPOT_SCOPES,
      scopeDelimiter: " ",
      requestOfflineAccess: true,
    };
  }

  async processOAuthTokens(
    tokens: Record<string, unknown>,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    tokenExpiry?: Date;
    scopes: string[];
    metadata: HubSpotMetadata;
  }> {
    const accessToken = tokens.access_token as string;
    const refreshToken = tokens.refresh_token as string | undefined;
    const expiresIn = tokens.expires_in as number | undefined;

    // HubSpot access tokens expire after ~30 minutes
    const tokenExpiry = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : new Date(Date.now() + 1800 * 1000);

    // Parse scopes from token response
    const scopeStr = (tokens.scope as string) ?? (tokens.raw as Record<string, unknown>)?.scope;
    const scopes = typeof scopeStr === "string" ? scopeStr.split(" ") : HUBSPOT_SCOPES;

    // Fetch account info for metadata
    let metadata: HubSpotMetadata = {
      portalId: "",
      hubDomain: "",
    };

    try {
      const accountRes = await hubspotFetch(
        "/account-info/v3/details",
        accessToken,
      );
      if (accountRes.ok) {
        const account = await accountRes.json();
        metadata = {
          portalId: String(account.portalId ?? ""),
          hubDomain: account.uiDomain ?? "",
          timeZone: account.timeZone ?? undefined,
          currency: account.currency ?? undefined,
        };
      }
    } catch (err) {
      console.error("[HubSpot] Failed to fetch account info:", err);
    }

    return {
      accessToken,
      refreshToken,
      tokenExpiry,
      scopes,
      metadata,
    };
  }

  async validateCredentials(
    envelope: CredentialEnvelope,
  ): Promise<ValidationResult> {
    if (!envelope.accessToken) {
      return { valid: false, reason: "No access token stored" };
    }

    try {
      const res = await hubspotFetch(
        "/account-info/v3/details",
        envelope.accessToken,
      );

      if (res.status === 401) {
        return { valid: false, reason: "Access token expired or revoked" };
      }

      if (!res.ok) {
        return { valid: false, reason: `API error: ${res.status}` };
      }

      const account = await res.json();
      return {
        valid: true,
        accountInfo: {
          portalId: account.portalId,
          hubDomain: account.uiDomain,
        },
      };
    } catch (err) {
      return {
        valid: false,
        reason: `Connection failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  }

  async refreshToken(
    envelope: CredentialEnvelope,
  ): Promise<TokenRefreshResult | null> {
    if (!envelope.refreshToken) {
      console.error("[HubSpot] No refresh token available");
      return null;
    }

    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error("[HubSpot] Missing client credentials env vars");
      return null;
    }

    try {
      const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: envelope.refreshToken,
        }),
      });

      if (!res.ok) {
        console.error("[HubSpot] Token refresh failed:", await res.text());
        return null;
      }

      const data = await res.json();
      const expiresIn = (data.expires_in as number) ?? 1800;

      return {
        accessToken: data.access_token,
        tokenExpiry: new Date(Date.now() + expiresIn * 1000),
        // HubSpot does NOT rotate refresh tokens
      };
    } catch (err) {
      console.error("[HubSpot] Token refresh error:", err);
      return null;
    }
  }

  getChatTools(): ChatToolDefinition[] {
    return [
      {
        type: "function",
        function: {
          name: "hubspot_search_contacts",
          description:
            "Search for HubSpot contacts by name, email, or other properties",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query (name, email, or company)",
              },
              limit: {
                type: "number",
                description: "Maximum number of results (default: 10, max: 100)",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "hubspot_get_contact",
          description: "Get a HubSpot contact by ID with all properties",
          parameters: {
            type: "object",
            properties: {
              contactId: {
                type: "string",
                description: "The HubSpot contact ID",
              },
            },
            required: ["contactId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "hubspot_create_contact",
          description: "Create a new contact in HubSpot",
          parameters: {
            type: "object",
            properties: {
              email: { type: "string", description: "Contact email address" },
              firstname: { type: "string", description: "First name" },
              lastname: { type: "string", description: "Last name" },
              phone: { type: "string", description: "Phone number" },
              company: { type: "string", description: "Company name" },
              jobtitle: { type: "string", description: "Job title" },
            },
            required: ["email"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "hubspot_search_deals",
          description:
            "Search for HubSpot deals by name, stage, or amount",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query for deal name",
              },
              stage: {
                type: "string",
                description: "Filter by deal stage (e.g., closedwon, closedlost)",
              },
              limit: {
                type: "number",
                description: "Maximum number of results (default: 10)",
              },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "hubspot_create_deal",
          description: "Create a new deal in HubSpot",
          parameters: {
            type: "object",
            properties: {
              dealname: { type: "string", description: "Deal name" },
              amount: { type: "string", description: "Deal amount" },
              dealstage: {
                type: "string",
                description: "Deal stage ID (e.g., appointmentscheduled)",
              },
              pipeline: {
                type: "string",
                description: "Pipeline ID (default: default pipeline)",
              },
              closedate: {
                type: "string",
                description: "Expected close date (ISO 8601)",
              },
            },
            required: ["dealname"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "hubspot_search_companies",
          description: "Search for HubSpot companies by name or domain",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query (company name or domain)",
              },
              limit: {
                type: "number",
                description: "Maximum number of results (default: 10)",
              },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "hubspot_create_note",
          description:
            "Create a note and optionally associate it with a contact, deal, or company",
          parameters: {
            type: "object",
            properties: {
              body: {
                type: "string",
                description: "Note content (supports HTML)",
              },
              contactId: {
                type: "string",
                description: "Contact ID to associate with",
              },
              dealId: {
                type: "string",
                description: "Deal ID to associate with",
              },
              companyId: {
                type: "string",
                description: "Company ID to associate with",
              },
            },
            required: ["body"],
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
    switch (toolName) {
      case "hubspot_search_contacts":
        return this.searchObjects("contacts", args, accessToken);
      case "hubspot_get_contact":
        return this.getObject("contacts", args.contactId as string, accessToken);
      case "hubspot_create_contact":
        return this.createObject("contacts", args, accessToken);
      case "hubspot_search_deals":
        return this.searchObjects("deals", args, accessToken);
      case "hubspot_create_deal":
        return this.createObject("deals", args, accessToken);
      case "hubspot_search_companies":
        return this.searchObjects("companies", args, accessToken);
      case "hubspot_create_note":
        return this.createNote(args, accessToken);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  // ---- Private helpers ----

  private async searchObjects(
    objectType: string,
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const query = (args.query as string) ?? "";
    const limit = Math.min(Number(args.limit) || 10, 100);

    // Build filter groups based on args
    const filterGroups: Record<string, unknown>[] = [];

    if (args.stage && objectType === "deals") {
      filterGroups.push({
        filters: [
          {
            propertyName: "dealstage",
            operator: "EQ",
            value: args.stage as string,
          },
        ],
      });
    }

    const body: Record<string, unknown> = {
      query,
      limit,
      properties: this.getDefaultProperties(objectType),
    };
    if (filterGroups.length > 0) {
      body.filterGroups = filterGroups;
    }

    const res = await hubspotFetch(
      `/crm/v3/objects/${objectType}/search`,
      accessToken,
      { method: "POST", body: JSON.stringify(body) },
    );

    if (!res.ok) {
      return { error: `Search failed: ${res.status}`, details: await res.text() };
    }
    return res.json();
  }

  private async getObject(
    objectType: string,
    objectId: string,
    accessToken: string,
  ): Promise<unknown> {
    const properties = this.getDefaultProperties(objectType).join(",");
    const res = await hubspotFetch(
      `/crm/v3/objects/${objectType}/${objectId}?properties=${properties}`,
      accessToken,
    );

    if (!res.ok) {
      return { error: `Get failed: ${res.status}`, details: await res.text() };
    }
    return res.json();
  }

  private async createObject(
    objectType: string,
    properties: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const res = await hubspotFetch(
      `/crm/v3/objects/${objectType}`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({ properties }),
      },
    );

    if (!res.ok) {
      return { error: `Create failed: ${res.status}`, details: await res.text() };
    }
    return res.json();
  }

  private async createNote(
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    // Create the note
    const noteRes = await hubspotFetch(
      "/crm/v3/objects/notes",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          properties: {
            hs_note_body: args.body as string,
            hs_timestamp: new Date().toISOString(),
          },
        }),
      },
    );

    if (!noteRes.ok) {
      return { error: `Note creation failed: ${noteRes.status}`, details: await noteRes.text() };
    }

    const note = await noteRes.json();
    const noteId = note.id;

    // Associate with objects if IDs provided
    const associations: string[] = [];
    if (args.contactId) {
      await this.createAssociation("notes", noteId, "contacts", args.contactId as string, accessToken);
      associations.push(`contact:${args.contactId}`);
    }
    if (args.dealId) {
      await this.createAssociation("notes", noteId, "deals", args.dealId as string, accessToken);
      associations.push(`deal:${args.dealId}`);
    }
    if (args.companyId) {
      await this.createAssociation("notes", noteId, "companies", args.companyId as string, accessToken);
      associations.push(`company:${args.companyId}`);
    }

    return { ...note, associations };
  }

  private async createAssociation(
    fromType: string,
    fromId: string,
    toType: string,
    toId: string,
    accessToken: string,
  ): Promise<void> {
    // Use default association type
    await hubspotFetch(
      `/crm/v3/objects/${fromType}/${fromId}/associations/${toType}/${toId}/note_to_${toType.slice(0, -1)}`,
      accessToken,
      { method: "PUT" },
    );
  }

  private getDefaultProperties(objectType: string): string[] {
    switch (objectType) {
      case "contacts":
        return ["firstname", "lastname", "email", "phone", "company", "jobtitle", "createdate", "lastmodifieddate"];
      case "deals":
        return ["dealname", "amount", "dealstage", "pipeline", "closedate", "createdate", "lastmodifieddate"];
      case "companies":
        return ["name", "domain", "industry", "phone", "city", "state", "country", "createdate"];
      case "tasks":
        return ["hs_task_subject", "hs_task_body", "hs_task_status", "hs_task_priority", "hs_timestamp"];
      case "notes":
        return ["hs_note_body", "hs_timestamp", "hs_lastmodifieddate"];
      default:
        return [];
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const hubspotAdapter = new HubSpotAdapter();
