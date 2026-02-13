import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptToken } from "@/lib/integrations/encryption";

const HOOTSUITE_CLIENT_ID = process.env.HOOTSUITE_CLIENT_ID;
const PROVIDER = "hootsuite";

// Hootsuite OAuth scopes
const SCOPES = ["offline"];

// GET /api/integrations/hootsuite - Start OAuth or check connection status
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      const url = new URL(request.url);
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
        const accessToken = decryptToken(integration.accessToken!);

        const response = await fetch("https://platform.hootsuite.com/v1/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

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
    if (!HOOTSUITE_CLIENT_ID) {
      console.error("HOOTSUITE_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=hootsuite_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    const HOOTSUITE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/hootsuite/callback`;

    // Build the Hootsuite OAuth authorization URL
    const authUrl = new URL("https://platform.hootsuite.com/oauth2/auth");
    authUrl.searchParams.set("client_id", HOOTSUITE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", HOOTSUITE_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error with Hootsuite integration:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}

// DELETE /api/integrations/hootsuite - Remove credentials
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
    console.error("Error removing Hootsuite integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
