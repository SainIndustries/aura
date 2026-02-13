import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const HELPSCOUT_CLIENT_ID = process.env.HELPSCOUT_CLIENT_ID;
const HELPSCOUT_CLIENT_SECRET = process.env.HELPSCOUT_CLIENT_SECRET;
const PROVIDER = "help-scout";

interface HelpScoutTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

interface HelpScoutUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  photoUrl?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check for OAuth errors
  if (error) {
    console.error("Help Scout OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=helpscout_oauth_denied`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=invalid_callback`
    );
  }

  try {
    // Validate CSRF state
    const isValidState = await validateState(state);
    if (!isValidState) {
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=invalid_state`
      );
    }

    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(`${baseUrl}/sign-in?redirect=/integrations`);
    }

    const HELPSCOUT_REDIRECT_URI = `${baseUrl}/api/integrations/help-scout/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch(
      "https://api.helpscout.net/v2/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: HELPSCOUT_CLIENT_ID!,
          client_secret: HELPSCOUT_CLIENT_SECRET!,
          code,
          redirect_uri: HELPSCOUT_REDIRECT_URI,
        }),
      }
    );

    const tokens: HelpScoutTokenResponse = await tokenResponse.json();

    if (tokens.error || !tokens.access_token) {
      console.error(
        "Failed to exchange code for tokens:",
        tokens.error_description || tokens.error
      );
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    // Fetch user info
    const userInfoResponse = await fetch("https://api.helpscout.net/v2/users/me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    let userInfo: HelpScoutUser | null = null;
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json();
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry,
      scopes: ["conversations", "docs", "beacon", "reports", "workflows"],
      metadata: {
        helpscoutId: userInfo?.id,
        firstName: userInfo?.firstName,
        lastName: userInfo?.lastName,
        email: userInfo?.email,
        role: userInfo?.role,
        photoUrl: userInfo?.photoUrl,
      },
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(integrations)
        .set(integrationData)
        .where(eq(integrations.id, existing.id));
    } else {
      await db.insert(integrations).values({
        userId: user.id,
        provider: PROVIDER,
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=help-scout`);
  } catch (error) {
    console.error("Error in Help Scout OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
