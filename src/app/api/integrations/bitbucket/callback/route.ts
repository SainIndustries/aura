import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const BITBUCKET_CLIENT_ID = process.env.BITBUCKET_CLIENT_ID;
const BITBUCKET_CLIENT_SECRET = process.env.BITBUCKET_CLIENT_SECRET;
const BITBUCKET_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/bitbucket/callback`;

interface BitbucketTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scopes: string;
  error?: string;
  error_description?: string;
}

interface BitbucketUser {
  uuid: string;
  username: string;
  display_name: string;
  links: {
    avatar: {
      href: string;
    };
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
    console.error("Bitbucket OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=bitbucket_oauth_denied`
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

    // Exchange code for tokens using Basic Auth
    const basicAuth = Buffer.from(
      `${BITBUCKET_CLIENT_ID}:${BITBUCKET_CLIENT_SECRET}`
    ).toString("base64");

    const tokenResponse = await fetch(
      "https://bitbucket.org/site/oauth2/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: BITBUCKET_REDIRECT_URI,
        }),
      }
    );

    const tokens: BitbucketTokenResponse = await tokenResponse.json();

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
    const userInfoResponse = await fetch("https://api.bitbucket.org/2.0/user", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    let userInfo: BitbucketUser | null = null;
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
    const scopes = tokens.scopes ? tokens.scopes.split(" ").filter(Boolean) : [];

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "bitbucket")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry,
      scopes,
      metadata: {
        uuid: userInfo?.uuid,
        username: userInfo?.username,
        displayName: userInfo?.display_name,
        avatarUrl: userInfo?.links?.avatar?.href,
      },
      updatedAt: new Date(),
    };

    if (existing) {
      // Update existing integration
      await db
        .update(integrations)
        .set(integrationData)
        .where(eq(integrations.id, existing.id));
    } else {
      // Create new integration
      await db.insert(integrations).values({
        userId: user.id,
        provider: "bitbucket",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=bitbucket`);
  } catch (error) {
    console.error("Error in Bitbucket OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
