import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptToken } from "@/lib/integrations/encryption";
import crypto from "crypto";

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const PROVIDER = "twitter";

// Twitter OAuth 2.0 scopes
const SCOPES = ["tweet.read", "users.read", "offline.access"];

// GET /api/integrations/twitter - Start OAuth or check connection status
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

        const response = await fetch("https://api.twitter.com/2/users/me", {
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
    if (!TWITTER_CLIENT_ID) {
      console.error("TWITTER_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=twitter_not_configured`
      );
    }

    // Generate state and PKCE code verifier for CSRF protection
    const state = await generateState();
    
    // Generate PKCE code verifier and challenge (Twitter requires PKCE)
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    // Store code verifier in state (will be extracted in callback)
    const stateWithVerifier = `${state}:${codeVerifier}`;

    const TWITTER_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/twitter/callback`;

    // Build the Twitter OAuth 2.0 authorization URL
    const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
    authUrl.searchParams.set("client_id", TWITTER_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", TWITTER_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", stateWithVerifier);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error with Twitter integration:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}

// DELETE /api/integrations/twitter - Remove credentials
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
    console.error("Error removing Twitter integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
