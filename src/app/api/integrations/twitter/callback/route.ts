import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const PROVIDER = "twitter";

interface TwitterTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface TwitterUser {
  data: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
    description?: string;
    verified?: boolean;
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check for OAuth errors
  if (error) {
    console.error("Twitter OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=twitter_oauth_denied`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=invalid_callback`
    );
  }

  try {
    // Extract state and code verifier
    const [oauthState, codeVerifier] = state.split(":");
    
    if (!oauthState || !codeVerifier) {
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=invalid_state`
      );
    }

    // Validate CSRF state
    const isValidState = await validateState(oauthState);
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

    const TWITTER_REDIRECT_URI = `${baseUrl}/api/integrations/twitter/callback`;

    // Exchange code for tokens (Twitter uses Basic Auth for confidential clients)
    const auth = Buffer.from(
      `${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`
    ).toString("base64");

    const tokenResponse = await fetch(
      "https://api.twitter.com/2/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: TWITTER_REDIRECT_URI,
          code_verifier: codeVerifier,
        }),
      }
    );

    const tokens: TwitterTokenResponse = await tokenResponse.json();

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
      "https://api.twitter.com/2/users/me?user.fields=profile_image_url,description,verified",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    let userInfo: TwitterUser | null = null;
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
    const scopes = tokens.scope?.split(" ") || ["tweet.read", "users.read", "offline.access"];

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
        twitterId: userInfo?.data?.id,
        name: userInfo?.data?.name,
        username: userInfo?.data?.username,
        profileImageUrl: userInfo?.data?.profile_image_url,
        description: userInfo?.data?.description,
        verified: userInfo?.data?.verified,
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

    return NextResponse.redirect(`${baseUrl}/integrations?success=twitter`);
  } catch (error) {
    console.error("Error in Twitter OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
