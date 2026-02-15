import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { encryptToken, decryptToken } from "@/lib/integrations/encryption";

const ZENDESK_CLIENT_ID = process.env.ZENDESK_CLIENT_ID;
const PROVIDER = "zendesk";

// GET /api/integrations/zendesk - Start OAuth or check connection status
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      const url = new URL(request.url);
      // If it's an OAuth initiation (no specific query params), redirect to sign in
      if (!url.searchParams.has("status")) {
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
        );
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);

    // Check if this is a status check
    if (url.searchParams.has("status")) {
      const integration = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.userId, user.id),
          eq(integrations.provider, PROVIDER)
        ),
      });

      if (!integration) {
        return NextResponse.json({
          connected: false,
          provider: PROVIDER,
        });
      }

      // Verify credentials are still valid
      let isValid = false;
      try {
        const metadata = integration.metadata as { subdomain: string };
        const accessToken = decryptToken(integration.accessToken!);

        const response = await fetch(
          `https://${metadata.subdomain}.zendesk.com/api/v2/users/me`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (response.ok) {
          isValid = true;
        }
      } catch {
        isValid = false;
      }

      return NextResponse.json({
        connected: true,
        provider: PROVIDER,
        connectedAt: integration.connectedAt,
        isValid,
        metadata: integration.metadata,
      });
    }

    // OAuth initiation
    if (!ZENDESK_CLIENT_ID) {
      console.error("ZENDESK_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=zendesk_not_configured`
      );
    }

    // Get subdomain from query params (required for Zendesk OAuth)
    const subdomain = url.searchParams.get("subdomain");
    if (!subdomain) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=zendesk_subdomain_required`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState(user.id);

    const ZENDESK_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/zendesk/callback`;

    // Build the Zendesk OAuth authorization URL
    const authUrl = new URL(
      `https://${subdomain}.zendesk.com/oauth/authorizations/new`
    );
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", ZENDESK_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", ZENDESK_REDIRECT_URI);
    authUrl.searchParams.set("scope", "read write");
    authUrl.searchParams.set("state", `${state}:${subdomain}`);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error with Zendesk integration:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}

// POST /api/integrations/zendesk - Save API token credentials
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subdomain, email, apiToken } = body;

    if (!subdomain || typeof subdomain !== "string") {
      return NextResponse.json(
        { error: "Subdomain is required" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!apiToken || typeof apiToken !== "string") {
      return NextResponse.json(
        { error: "API Token is required" },
        { status: 400 }
      );
    }

    // Validate credentials by making a test request
    const auth = Buffer.from(`${email}/token:${apiToken}`).toString("base64");
    const validationResponse = await fetch(
      `https://${subdomain}.zendesk.com/api/v2/users/me`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    if (!validationResponse.ok) {
      return NextResponse.json(
        { error: "Invalid credentials. Please check your subdomain, email, and API token." },
        { status: 400 }
      );
    }

    const userData = await validationResponse.json();
    const zendeskUser = userData.user;

    // Encrypt the API token
    const encryptedToken = encryptToken(apiToken);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    const metadata = {
      subdomain,
      email,
      userId: zendeskUser.id,
      name: zendeskUser.name,
      role: zendeskUser.role,
      avatarUrl: zendeskUser.photo?.content_url,
      authType: "api_token",
    };

    if (existing) {
      await db
        .update(integrations)
        .set({
          accessToken: encryptedToken,
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id));

      return NextResponse.json({ success: true, updated: true });
    }

    const [newIntegration] = await db
      .insert(integrations)
      .values({
        userId: user.id,
        provider: PROVIDER,
        accessToken: encryptedToken,
        scopes: ["tickets", "chat", "knowledge_base", "reports", "automations"],
        metadata,
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving Zendesk credentials:", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/zendesk - Remove credentials
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    await db.delete(integrations).where(eq(integrations.id, integration.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing Zendesk integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
