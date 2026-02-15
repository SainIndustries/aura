// ---------------------------------------------------------------------------
// E2E adapter validation tests.
//
// Validates that every integration adapter correctly implements the unified
// IntegrationAdapter framework interface. Tests structural compliance,
// OAuth config validity, chat tool definitions, VM skill manifests, and
// cross-adapter consistency.
//
// NOTE: These tests import adapter singletons and validate their structure
// without making real API calls. All external calls are mocked.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeAll } from "vitest";

// ---- Mock external dependencies before adapter imports ----
vi.mock("@/lib/db", () => ({ db: { query: {} } }));
vi.mock("@/lib/integrations/encryption", () => ({
  encryptToken: (t: string) => `enc:${t}`,
  decryptToken: (t: string) => t.replace("enc:", ""),
}));

// ---- Import adapters ----
import { slackAdapter } from "@/integrations/providers/slack/adapter";
import { twilioAdapter } from "@/integrations/providers/twilio/adapter";
import { outlookAdapter } from "@/integrations/providers/outlook/adapter";
import { hubspotAdapter } from "@/integrations/providers/hubspot/adapter";
import { salesforceAdapter } from "@/integrations/providers/salesforce/adapter";
import { googleCalendarAdapter } from "@/integrations/providers/google-calendar/adapter";

// ---- Import framework types for validation ----
import type {
  IntegrationAdapter,
  OAuthConfig,
  ChatToolDefinition,
  VmSkillManifest,
} from "@/integrations/types";

// ---- Import existing provider registry for cross-reference ----
import { integrationProviders } from "@/lib/integrations/providers";

// ===========================================================================
// All adapters in a single collection for iteration
// ===========================================================================

const ALL_ADAPTERS: IntegrationAdapter[] = [
  slackAdapter,
  twilioAdapter,
  outlookAdapter,
  hubspotAdapter,
  salesforceAdapter,
  googleCalendarAdapter,
];

const OAUTH_ADAPTERS = ALL_ADAPTERS.filter(
  (a) => a.authStrategy === "oauth2",
) as IntegrationAdapter[];

const API_KEY_ADAPTERS = ALL_ADAPTERS.filter(
  (a) => a.authStrategy === "api_key",
) as IntegrationAdapter[];

// ===========================================================================
// 1. Interface Compliance
// ===========================================================================

describe("Interface Compliance", () => {
  it.each(ALL_ADAPTERS.map((a) => [a.id, a]))(
    "%s — has required identity fields",
    (_id, adapter) => {
      expect(adapter.id).toBeTruthy();
      expect(typeof adapter.id).toBe("string");
      expect(adapter.displayName).toBeTruthy();
      expect(typeof adapter.displayName).toBe("string");
      expect(["oauth2", "api_key", "webhook"]).toContain(adapter.authStrategy);
    },
  );

  it.each(ALL_ADAPTERS.map((a) => [a.id, a]))(
    "%s — has required methods",
    (_id, adapter) => {
      // All adapters must have these
      expect(typeof adapter.getOAuthConfig).toBe("function");
      expect(typeof adapter.getApiKeyFields).toBe("function");
      expect(typeof adapter.validateCredentials).toBe("function");
      expect(typeof adapter.getChatTools).toBe("function");
    },
  );

  it("all adapters have unique IDs", () => {
    const ids = ALL_ADAPTERS.map((a) => a.id);
    const uniqueIds = new Set(ids);
    // google-calendar uses id="google" which is shared, so we allow that
    // All other adapters must be unique
    const nonGoogleIds = ids.filter((id) => id !== "google");
    expect(new Set(nonGoogleIds).size).toBe(nonGoogleIds.length);
  });
});

// ===========================================================================
// 2. OAuth Config Validation
// ===========================================================================

describe("OAuth Config Validation", () => {
  it.each(OAUTH_ADAPTERS.map((a) => [a.id, a]))(
    "%s — returns valid OAuthConfig",
    (_id, adapter) => {
      const config = adapter.getOAuthConfig();
      expect(config).not.toBeNull();

      if (!config) return; // type narrowing

      // Required fields
      expect(config.authorizationUrl).toBeTruthy();
      expect(config.authorizationUrl).toMatch(/^https:\/\//);
      expect(config.tokenUrl).toBeTruthy();
      expect(config.tokenUrl).toMatch(/^https:\/\//);
      expect(config.clientIdEnvVar).toBeTruthy();
      expect(config.clientSecretEnvVar).toBeTruthy();
      expect(config.scopes).toBeInstanceOf(Array);
      expect(config.scopes.length).toBeGreaterThan(0);
    },
  );

  it.each(OAUTH_ADAPTERS.map((a) => [a.id, a]))(
    "%s — env var names follow convention",
    (_id, adapter) => {
      const config = adapter.getOAuthConfig()!;
      // Env var names should be UPPER_SNAKE_CASE
      expect(config.clientIdEnvVar).toMatch(/^[A-Z][A-Z0-9_]+$/);
      expect(config.clientSecretEnvVar).toMatch(/^[A-Z][A-Z0-9_]+$/);
    },
  );

  it.each(API_KEY_ADAPTERS.map((a) => [a.id, a]))(
    "%s — returns null for getOAuthConfig",
    (_id, adapter) => {
      expect(adapter.getOAuthConfig()).toBeNull();
    },
  );
});

// ===========================================================================
// 3. API Key Fields Validation
// ===========================================================================

describe("API Key Fields Validation", () => {
  it.each(API_KEY_ADAPTERS.map((a) => [a.id, a]))(
    "%s — returns valid field descriptors",
    (_id, adapter) => {
      const fields = adapter.getApiKeyFields();
      expect(fields).not.toBeNull();
      expect(fields!.length).toBeGreaterThan(0);

      for (const field of fields!) {
        expect(field.name).toBeTruthy();
        expect(field.label).toBeTruthy();
        expect(typeof field.required).toBe("boolean");
      }

      // At least one field must be required
      expect(fields!.some((f) => f.required)).toBe(true);
    },
  );

  it.each(OAUTH_ADAPTERS.map((a) => [a.id, a]))(
    "%s — returns null for getApiKeyFields",
    (_id, adapter) => {
      expect(adapter.getApiKeyFields()).toBeNull();
    },
  );
});

// ===========================================================================
// 4. Chat Tools Validation
// ===========================================================================

describe("Chat Tools Validation", () => {
  it.each(ALL_ADAPTERS.map((a) => [a.id, a]))(
    "%s — getChatTools returns valid tool definitions",
    (_id, adapter) => {
      const tools = adapter.getChatTools();
      expect(tools).toBeInstanceOf(Array);
      expect(tools.length).toBeGreaterThan(0);

      for (const tool of tools) {
        // OpenAI function-calling format
        expect(tool.type).toBe("function");
        expect(tool.function.name).toBeTruthy();
        expect(typeof tool.function.name).toBe("string");
        expect(tool.function.description).toBeTruthy();
        expect(typeof tool.function.description).toBe("string");
        expect(tool.function.parameters).toBeDefined();
        expect(typeof tool.function.parameters).toBe("object");
      }
    },
  );

  it.each(ALL_ADAPTERS.map((a) => [a.id, a]))(
    "%s — tool names are unique within adapter",
    (_id, adapter) => {
      const tools = adapter.getChatTools();
      const names = tools.map((t) => t.function.name);
      expect(new Set(names).size).toBe(names.length);
    },
  );

  it("tool names are unique across all adapters", () => {
    const allNames: string[] = [];
    for (const adapter of ALL_ADAPTERS) {
      const tools = adapter.getChatTools();
      for (const tool of tools) {
        allNames.push(tool.function.name);
      }
    }
    expect(new Set(allNames).size).toBe(allNames.length);
  });
});

// ===========================================================================
// 5. VM Skill Validation (Google Calendar)
// ===========================================================================

describe("VM Skill Validation", () => {
  it("google calendar provides a VM skill manifest", () => {
    const manifest = googleCalendarAdapter.getVmSkillManifest?.(
      "test-gateway-token",
    );
    expect(manifest).not.toBeNull();
    expect(manifest).toBeDefined();

    if (!manifest) return;

    // Required fields
    expect(manifest.skillDirName).toBeTruthy();
    expect(manifest.writeFiles).toBeInstanceOf(Array);
    expect(manifest.writeFiles.length).toBeGreaterThan(0);
    expect(manifest.services).toBeInstanceOf(Array);
    expect(manifest.caddyRoutes).toBeInstanceOf(Array);

    // Write files have required fields
    for (const file of manifest.writeFiles) {
      expect(file.path).toBeTruthy();
      expect(file.path).toMatch(/^\//); // absolute path
      expect(file.content).toBeTruthy();
    }

    // Caddy routes have required fields
    for (const route of manifest.caddyRoutes) {
      expect(route.matchPath).toBeTruthy();
      expect(route.matchPath).toMatch(/^\//);
      expect(route.upstreamPort).toBeGreaterThan(0);
    }
  });

  it("google calendar provides buildVmCredentialPayload", () => {
    expect(typeof googleCalendarAdapter.buildVmCredentialPayload).toBe(
      "function",
    );
  });

  it.each(
    ALL_ADAPTERS.filter((a) => a.id !== "google").map((a) => [a.id, a]),
  )("%s — non-VM adapters return null/undefined for VM methods", (_id, adapter) => {
    // Non-VM adapters either don't have the method or return null
    if (adapter.getVmSkillManifest) {
      expect(adapter.getVmSkillManifest("token")).toBeNull();
    }
  });
});

// ===========================================================================
// 6. Cross-Adapter Consistency
// ===========================================================================

describe("Cross-Adapter Consistency", () => {
  it("most adapter IDs exist in the provider registry", () => {
    const providerIds = new Set(integrationProviders.map((p) => p.id));
    // Known ID mismatches: outlook adapter uses "outlook" but providers.tsx
    // uses "microsoft-365". This is fine — adapter.id matches the DB column.
    const knownMismatches = new Set(["outlook"]);

    for (const adapter of ALL_ADAPTERS) {
      if (!knownMismatches.has(adapter.id)) {
        expect(providerIds.has(adapter.id)).toBe(true);
      }
    }
  });

  it("auth strategies match expected patterns", () => {
    // Twilio is the only API key adapter
    expect(twilioAdapter.authStrategy).toBe("api_key");

    // All others are OAuth
    expect(slackAdapter.authStrategy).toBe("oauth2");
    expect(outlookAdapter.authStrategy).toBe("oauth2");
    expect(hubspotAdapter.authStrategy).toBe("oauth2");
    expect(salesforceAdapter.authStrategy).toBe("oauth2");
    expect(googleCalendarAdapter.authStrategy).toBe("oauth2");
  });

  it("OAuth adapters that support refresh have the method", () => {
    // These should all support token refresh
    for (const adapter of [
      slackAdapter,
      outlookAdapter,
      hubspotAdapter,
      salesforceAdapter,
      googleCalendarAdapter,
    ]) {
      expect(typeof adapter.refreshToken).toBe("function");
    }
  });
});

// ===========================================================================
// 7. Regression Checks — Existing Integrations
// ===========================================================================

describe("Regression: Existing Integration Patterns", () => {
  describe("Google Workspace (Gmail + Calendar) compatibility", () => {
    it("google calendar adapter uses 'google' as provider ID", () => {
      // Must match existing integrations.provider = "google" in DB
      expect(googleCalendarAdapter.id).toBe("google");
    });

    it("google OAuth config matches existing scopes", () => {
      const config = googleCalendarAdapter.getOAuthConfig()!;
      const expectedScopes = [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
      ];
      for (const scope of expectedScopes) {
        expect(config.scopes).toContain(scope);
      }
    });

    it("google OAuth config uses correct env vars", () => {
      const config = googleCalendarAdapter.getOAuthConfig()!;
      expect(config.clientIdEnvVar).toBe("GOOGLE_CLIENT_ID");
      expect(config.clientSecretEnvVar).toBe("GOOGLE_CLIENT_SECRET");
    });

    it("google OAuth requests offline access", () => {
      const config = googleCalendarAdapter.getOAuthConfig()!;
      expect(config.requestOfflineAccess).toBe(true);
    });

    it("google VM skill uses correct credential path", () => {
      const manifest = googleCalendarAdapter.getVmSkillManifest?.(
        "test-token",
      );
      if (!manifest) return;

      // Should write to /root/google-workspace-skill/
      const skillFile = manifest.writeFiles.find((f) =>
        f.path.includes("google-workspace-skill"),
      );
      expect(skillFile).toBeDefined();

      // Caddy route should match existing pattern
      const route = manifest.caddyRoutes.find((r) =>
        r.matchPath.includes("google-credentials"),
      );
      expect(route).toBeDefined();
      if (route) {
        expect(route.upstreamPort).toBe(18790);
      }
    });
  });

  describe("ElevenLabs pattern compatibility", () => {
    it("API key adapter pattern matches ElevenLabs approach", () => {
      // Twilio uses the same ApiKeyAdapter pattern as ElevenLabs
      // Validate the pattern is consistent
      expect(twilioAdapter.authStrategy).toBe("api_key");
      const fields = twilioAdapter.getApiKeyFields()!;
      expect(fields.length).toBeGreaterThanOrEqual(1);

      // Must have a required primary key field
      const primaryField = fields.find((f) => f.name === "primaryKey");
      expect(primaryField).toBeDefined();
      expect(primaryField!.required).toBe(true);
    });
  });
});

// ===========================================================================
// 8. Adapter-Specific Validation
// ===========================================================================

describe("Adapter-Specific: Slack", () => {
  it("uses comma-delimited scopes", () => {
    const config = slackAdapter.getOAuthConfig()!;
    expect(config.scopeDelimiter).toBe(",");
  });

  it("has messaging chat tools", () => {
    const tools = slackAdapter.getChatTools();
    const names = tools.map((t) => t.function.name);
    // Tool names are prefixed with provider for cross-adapter uniqueness
    expect(names.some((n) => n.includes("send_message"))).toBe(true);
    expect(names.some((n) => n.includes("channels"))).toBe(true);
  });
});

describe("Adapter-Specific: Salesforce", () => {
  it("supports token refresh with rotation", () => {
    expect(typeof salesforceAdapter.refreshToken).toBe("function");
    // Salesforce rotates refresh tokens — the method must exist
  });

  it("has SOQL query tool", () => {
    const tools = salesforceAdapter.getChatTools();
    const names = tools.map((t) => t.function.name);
    expect(names.some((n) => n.includes("query"))).toBe(true);
  });
});

describe("Adapter-Specific: HubSpot", () => {
  it("has CRM search and create tools", () => {
    const tools = hubspotAdapter.getChatTools();
    const names = tools.map((t) => t.function.name);
    expect(names.some((n) => n.includes("search") && n.includes("contact"))).toBe(true);
    expect(names.some((n) => n.includes("create") && n.includes("deal"))).toBe(true);
  });
});

describe("Adapter-Specific: Outlook", () => {
  it("uses Microsoft Graph endpoints", () => {
    const config = outlookAdapter.getOAuthConfig()!;
    expect(config.authorizationUrl).toContain("microsoft");
    expect(config.tokenUrl).toContain("microsoft");
  });

  it("has email and calendar tools", () => {
    const tools = outlookAdapter.getChatTools();
    const names = tools.map((t) => t.function.name);
    expect(names.some((n) => n.includes("send") && n.includes("email"))).toBe(true);
    expect(names.some((n) => n.includes("event"))).toBe(true);
  });
});

describe("Adapter-Specific: Twilio", () => {
  it("has both SID and auth token fields", () => {
    const fields = twilioAdapter.getApiKeyFields()!;
    expect(fields.length).toBeGreaterThanOrEqual(2);

    const sidField = fields.find(
      (f) => f.name === "primaryKey" || f.label.toLowerCase().includes("sid"),
    );
    expect(sidField).toBeDefined();

    const tokenField = fields.find(
      (f) =>
        f.name === "secondaryKey" ||
        f.label.toLowerCase().includes("token") ||
        f.label.toLowerCase().includes("auth"),
    );
    expect(tokenField).toBeDefined();
  });

  it("has SMS tool", () => {
    const tools = twilioAdapter.getChatTools();
    const names = tools.map((t) => t.function.name);
    expect(names.some((n) => n.includes("sms"))).toBe(true);
  });
});
