// ---------------------------------------------------------------------------
// Salesforce CRM adapter — OAuth 2.0 integration for contacts, leads,
// opportunities, accounts, tasks, and notes.
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

export interface SalesforceMetadata extends Record<string, unknown> {
  instanceUrl: string;
  orgId: string;
  userId?: string;
  email?: string;
  displayName?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SALESFORCE_SCOPES = ["api", "refresh_token", "offline_access"];
const SALESFORCE_API_VERSION = "v66.0";
/** Conservative estimate — Salesforce doesn't return expires_in */
const SALESFORCE_TOKEN_TTL_SECONDS = 7200; // 2 hours

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function salesforceApiBase(instanceUrl: string): string {
  return `${instanceUrl}/services/data/${SALESFORCE_API_VERSION}`;
}

async function salesforceFetch(
  instanceUrl: string,
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${salesforceApiBase(instanceUrl)}${path}`, {
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

class SalesforceAdapter extends OAuthAdapter<SalesforceMetadata> {
  readonly id = "salesforce";
  readonly displayName = "Salesforce";

  getOAuthConfig(): OAuthConfig {
    return {
      authorizationUrl:
        "https://login.salesforce.com/services/oauth2/authorize",
      tokenUrl: "https://login.salesforce.com/services/oauth2/token",
      clientIdEnvVar: "SALESFORCE_CLIENT_ID",
      clientSecretEnvVar: "SALESFORCE_CLIENT_SECRET",
      scopes: SALESFORCE_SCOPES,
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
    metadata: SalesforceMetadata;
  }> {
    const accessToken = tokens.access_token as string;
    const refreshToken = tokens.refresh_token as string | undefined;
    const instanceUrl = tokens.instance_url as string;

    // Salesforce doesn't return expires_in — estimate ~2 hours
    const tokenExpiry = new Date(
      Date.now() + SALESFORCE_TOKEN_TTL_SECONDS * 1000,
    );

    // Parse org ID and user ID from the identity URL
    // Format: https://login.salesforce.com/id/{orgId}/{userId}
    const idUrl = tokens.id as string | undefined;
    let orgId = "";
    let sfUserId = "";
    if (idUrl) {
      const parts = idUrl.split("/");
      sfUserId = parts.pop() ?? "";
      orgId = parts.pop() ?? "";
    }

    // Fetch user info from the identity URL
    let email: string | undefined;
    let displayName: string | undefined;
    if (idUrl) {
      try {
        const userRes = await fetch(idUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (userRes.ok) {
          const userInfo = await userRes.json();
          email = userInfo.email;
          displayName = userInfo.display_name;
        }
      } catch (err) {
        console.error("[Salesforce] Failed to fetch user info:", err);
      }
    }

    return {
      accessToken,
      refreshToken,
      tokenExpiry,
      scopes: SALESFORCE_SCOPES,
      metadata: {
        instanceUrl,
        orgId,
        userId: sfUserId,
        email,
        displayName,
      },
    };
  }

  async validateCredentials(
    envelope: CredentialEnvelope,
  ): Promise<ValidationResult> {
    if (!envelope.accessToken) {
      return { valid: false, reason: "No access token stored" };
    }

    const instanceUrl = (envelope.metadata as unknown as SalesforceMetadata)?.instanceUrl;
    if (!instanceUrl) {
      return { valid: false, reason: "No instance URL in metadata" };
    }

    try {
      // Lightweight check — fetch API version list
      const res = await fetch(`${instanceUrl}/services/data/`, {
        headers: { Authorization: `Bearer ${envelope.accessToken}` },
      });

      if (res.status === 401) {
        return { valid: false, reason: "Access token expired or revoked" };
      }

      if (!res.ok) {
        return { valid: false, reason: `API error: ${res.status}` };
      }

      return { valid: true };
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
      console.error("[Salesforce] No refresh token available");
      return null;
    }

    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error("[Salesforce] Missing client credentials env vars");
      return null;
    }

    try {
      const res = await fetch(
        "https://login.salesforce.com/services/oauth2/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: envelope.refreshToken,
          }),
        },
      );

      if (!res.ok) {
        console.error("[Salesforce] Token refresh failed:", await res.text());
        return null;
      }

      const data = await res.json();

      return {
        accessToken: data.access_token,
        tokenExpiry: new Date(
          Date.now() + SALESFORCE_TOKEN_TTL_SECONDS * 1000,
        ),
        // Salesforce rotates refresh tokens since Spring 2024
        refreshToken: data.refresh_token ?? undefined,
      };
    } catch (err) {
      console.error("[Salesforce] Token refresh error:", err);
      return null;
    }
  }

  getChatTools(): ChatToolDefinition[] {
    return [
      {
        type: "function",
        function: {
          name: "salesforce_query",
          description:
            "Execute a SOQL query against Salesforce to search for records",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "SOQL query string (e.g., SELECT Id, Name FROM Contact WHERE Email != null LIMIT 10)",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "salesforce_get_record",
          description: "Get a single Salesforce record by object type and ID",
          parameters: {
            type: "object",
            properties: {
              objectType: {
                type: "string",
                description:
                  "Salesforce object type (Contact, Lead, Opportunity, Account, Task, Note)",
              },
              recordId: {
                type: "string",
                description: "The Salesforce record ID",
              },
            },
            required: ["objectType", "recordId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "salesforce_create_record",
          description: "Create a new record in Salesforce",
          parameters: {
            type: "object",
            properties: {
              objectType: {
                type: "string",
                description:
                  "Salesforce object type (Contact, Lead, Opportunity, Account, Task, Note)",
              },
              fields: {
                type: "object",
                description:
                  "Field values for the new record (e.g., { FirstName: 'John', LastName: 'Doe', Email: 'john@example.com' })",
              },
            },
            required: ["objectType", "fields"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "salesforce_update_record",
          description: "Update an existing Salesforce record",
          parameters: {
            type: "object",
            properties: {
              objectType: {
                type: "string",
                description: "Salesforce object type",
              },
              recordId: {
                type: "string",
                description: "The Salesforce record ID",
              },
              fields: {
                type: "object",
                description: "Fields to update",
              },
            },
            required: ["objectType", "recordId", "fields"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "salesforce_search",
          description:
            "Full-text search across multiple Salesforce objects using SOSL",
          parameters: {
            type: "object",
            properties: {
              searchTerm: {
                type: "string",
                description: "Text to search for across objects",
              },
              objectTypes: {
                type: "array",
                items: { type: "string" },
                description:
                  "Object types to search in (default: Contact, Lead, Account, Opportunity)",
              },
            },
            required: ["searchTerm"],
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
    // Get instance URL from args or fall back — caller should provide via envelope
    // In practice, the framework passes only accessToken; we need instanceUrl
    // from metadata. For chat tools, we'll extract it from the tool args or
    // require it to be set. The generic chat handler should pass it.
    const instanceUrl = (args._instanceUrl as string) ?? "";
    if (!instanceUrl) {
      return {
        error:
          "Missing Salesforce instance URL. Ensure the integration metadata is available.",
      };
    }

    switch (toolName) {
      case "salesforce_query":
        return this.executeSoql(instanceUrl, args.query as string, accessToken);
      case "salesforce_get_record":
        return this.getRecord(
          instanceUrl,
          args.objectType as string,
          args.recordId as string,
          accessToken,
        );
      case "salesforce_create_record":
        return this.createRecord(
          instanceUrl,
          args.objectType as string,
          args.fields as Record<string, unknown>,
          accessToken,
        );
      case "salesforce_update_record":
        return this.updateRecord(
          instanceUrl,
          args.objectType as string,
          args.recordId as string,
          args.fields as Record<string, unknown>,
          accessToken,
        );
      case "salesforce_search":
        return this.executeSosl(
          instanceUrl,
          args.searchTerm as string,
          (args.objectTypes as string[]) ?? [
            "Contact",
            "Lead",
            "Account",
            "Opportunity",
          ],
          accessToken,
        );
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  // ---- Private helpers ----

  private async executeSoql(
    instanceUrl: string,
    query: string,
    accessToken: string,
  ): Promise<unknown> {
    const res = await salesforceFetch(
      instanceUrl,
      `/query?q=${encodeURIComponent(query)}`,
      accessToken,
    );

    if (!res.ok) {
      return {
        error: `SOQL query failed: ${res.status}`,
        details: await res.text(),
      };
    }
    return res.json();
  }

  private async getRecord(
    instanceUrl: string,
    objectType: string,
    recordId: string,
    accessToken: string,
  ): Promise<unknown> {
    const res = await salesforceFetch(
      instanceUrl,
      `/sobjects/${objectType}/${recordId}`,
      accessToken,
    );

    if (!res.ok) {
      return {
        error: `Get record failed: ${res.status}`,
        details: await res.text(),
      };
    }
    return res.json();
  }

  private async createRecord(
    instanceUrl: string,
    objectType: string,
    fields: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const res = await salesforceFetch(
      instanceUrl,
      `/sobjects/${objectType}`,
      accessToken,
      { method: "POST", body: JSON.stringify(fields) },
    );

    if (!res.ok) {
      return {
        error: `Create record failed: ${res.status}`,
        details: await res.text(),
      };
    }
    return res.json();
  }

  private async updateRecord(
    instanceUrl: string,
    objectType: string,
    recordId: string,
    fields: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const res = await salesforceFetch(
      instanceUrl,
      `/sobjects/${objectType}/${recordId}`,
      accessToken,
      { method: "PATCH", body: JSON.stringify(fields) },
    );

    // Salesforce returns 204 No Content on successful PATCH
    if (res.status === 204) {
      return { success: true, id: recordId };
    }

    if (!res.ok) {
      return {
        error: `Update record failed: ${res.status}`,
        details: await res.text(),
      };
    }
    return res.json();
  }

  private async executeSosl(
    instanceUrl: string,
    searchTerm: string,
    objectTypes: string[],
    accessToken: string,
  ): Promise<unknown> {
    const returning = objectTypes.join(",");
    const sosl = `FIND {${searchTerm}} IN ALL FIELDS RETURNING ${returning}`;
    const res = await salesforceFetch(
      instanceUrl,
      `/search?q=${encodeURIComponent(sosl)}`,
      accessToken,
    );

    if (!res.ok) {
      return {
        error: `SOSL search failed: ${res.status}`,
        details: await res.text(),
      };
    }
    return res.json();
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const salesforceAdapter = new SalesforceAdapter();
