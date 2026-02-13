import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PROVIDER = "google-analytics";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check for OAuth errors
  if (error) {
    console.error("Google Analytics OAuth error:", error);
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

    const GOOGLE_REDIRECT_URI = `${baseUrl}/api/integrations/google-analytics/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: GOOGLE_REDIRECT_URI,
      }),
    });

    const tokens: GoogleTokenResponse = await tokenResponse.json();

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

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Parse scopes
    const scopes = tokens.scope?.split(" ") || ["analytics.readonly"];

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
      scopes,
      metadata: {
        googleId: userInfo?.id,
        email: userInfo?.email,
        name: userInfo?.name,
        picture: userInfo?.picture,
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

    return NextResponse.redirect(
      `${baseUrl}/integrations?success=google-analytics`
    );
  } catch (error) {
    console.error("Error in Google Analytics OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
