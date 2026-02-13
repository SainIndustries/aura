import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const CODA_CLIENT_ID = process.env.CODA_CLIENT_ID;
const CODA_CLIENT_SECRET = process.env.CODA_CLIENT_SECRET;
const CODA_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/coda/callback`;

interface CodaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface CodaUserInfo {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check for OAuth errors
  if (error) {
    console.error("Coda OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=coda_oauth_denied`
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

    // Exchange code for tokens
    const tokenResponse = await fetch("https://coda.io/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: CODA_CLIENT_ID!,
        client_secret: CODA_CLIENT_SECRET!,
        redirect_uri: CODA_REDIRECT_URI,
      }),
    });

    const tokens: CodaTokenResponse = await tokenResponse.json();

    if (tokens.error || !tokens.access_token) {
      console.error("Failed to exchange code for tokens:", tokens.error, tokens.error_description);
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    // Fetch user info from Coda
    let userInfo: CodaUserInfo | null = null;
    try {
      const userResponse = await fetch("https://coda.io/apis/v1/whoami", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      if (userResponse.ok) {
        userInfo = await userResponse.json();
      }
    } catch (e) {
      console.error("Failed to fetch Coda user info:", e);
    }

    // Calculate token expiry if provided
    const tokenExpiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Parse scopes
    const scopes = tokens.scope ? tokens.scope.split(" ") : ["doc:read", "doc:write"];

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "coda")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry,
      scopes,
      metadata: {
        userId: userInfo?.id,
        name: userInfo?.name,
        email: userInfo?.email,
        avatar: userInfo?.avatar,
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
        provider: "coda",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=coda`);
  } catch (error) {
    console.error("Error in Coda OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
