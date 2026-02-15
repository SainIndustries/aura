import { NextRequest, NextResponse } from "next/server";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { agents, integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { pushGoogleCredentialsToRunningInstances } from "@/lib/integrations/credential-push";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`;

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check for OAuth errors
  if (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=google_oauth_denied`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=invalid_callback`
    );
  }

  try {
    // Validate CSRF state and extract userId + agentId
    const stateData = await validateState(state);
    if (!stateData) {
      return new Response(
        `<html><body><script>window.close();</script><p>Invalid state. Please try again.</p></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }
    const { userId, agentId } = stateData;

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Failed to exchange code for tokens:", errorData);
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Fetch user info to get email
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    let userInfo: GoogleUserInfo | null = null;
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json();
    }

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Parse scopes
    const scopes = tokens.scope.split(" ");

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, userId),
        eq(integrations.provider, "google")
      ),
    });

    const integrationData: Record<string, unknown> = {
      accessToken: encryptedAccessToken,
      tokenExpiry,
      scopes,
      metadata: {
        email: userInfo?.email,
        name: userInfo?.name,
        picture: userInfo?.picture,
      },
      updatedAt: new Date(),
    };

    // Only overwrite refresh token if Google returned a new one
    if (encryptedRefreshToken) {
      integrationData.refreshToken = encryptedRefreshToken;
    }

    if (existing) {
      // Update existing integration
      await db
        .update(integrations)
        .set(integrationData)
        .where(eq(integrations.id, existing.id));
    } else {
      // Create new integration (always include refreshToken, even if null)
      await db.insert(integrations).values({
        userId,
        provider: "google",
        refreshToken: encryptedRefreshToken,
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    // Push credentials to any running OpenClaw VMs (fire-and-forget)
    pushGoogleCredentialsToRunningInstances(userId).catch((err) => {
      console.error("[Google OAuth callback] Failed to push credentials to VMs:", err);
    });

    // Auto-enable Google on the agent that initiated this OAuth flow
    if (agentId) {
      const agent = await db.query.agents.findFirst({
        where: and(eq(agents.id, agentId), eq(agents.userId, userId)),
      });
      if (agent) {
        const currentIntegrations = (agent.integrations as Record<string, unknown>) ?? {};
        await db
          .update(agents)
          .set({
            integrations: { ...currentIntegrations, google: true },
            updatedAt: new Date(),
          })
          .where(eq(agents.id, agentId));
      }
    }

    // Close the popup — the chat page polls for connection status
    return new Response(
      `<html><body><script>window.close();</script><p>Connected! You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("Error in Google OAuth callback:", error);
    return new Response(
      `<html><body><script>window.close();</script><p>Something went wrong. You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }
}
