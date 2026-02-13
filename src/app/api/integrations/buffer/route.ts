import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptToken } from "@/lib/integrations/encryption";

const BUFFER_CLIENT_ID = process.env.BUFFER_CLIENT_ID;
const PROVIDER = "buffer";

// GET /api/integrations/buffer - Start OAuth or check connection status
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

        const response = await fetch(
          `https://api.bufferapp.com/1/user.json?access_token=${accessToken}`
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
    if (!BUFFER_CLIENT_ID) {
      console.error("BUFFER_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=buffer_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    const BUFFER_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/buffer/callback`;

    // Build the Buffer OAuth authorization URL
    const authUrl = new URL("https://bufferapp.com/oauth2/authorize");
    authUrl.searchParams.set("client_id", BUFFER_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", BUFFER_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error with Buffer integration:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}

// DELETE /api/integrations/buffer - Remove credentials
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
    console.error("Error removing Buffer integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
