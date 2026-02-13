import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const WORKDAY_CLIENT_ID = process.env.WORKDAY_CLIENT_ID;
const WORKDAY_CLIENT_SECRET = process.env.WORKDAY_CLIENT_SECRET;
const WORKDAY_TENANT = process.env.WORKDAY_TENANT;
const WORKDAY_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/workday/callback`;

interface WorkdayTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface WorkdayUserInfo {
  sub: string;
  name?: string;
  email?: string;
  preferred_username?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check for OAuth errors
  if (error) {
    console.error("Workday OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=workday_oauth_denied`
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
    const tokenResponse = await fetch(
      `https://${WORKDAY_TENANT}.workday.com/ccx/oauth2/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${WORKDAY_CLIENT_ID}:${WORKDAY_CLIENT_SECRET}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: WORKDAY_REDIRECT_URI,
        }),
      }
    );

    const tokens: WorkdayTokenResponse = await tokenResponse.json();

    if (tokens.error || !tokens.access_token) {
      console.error(
        "Failed to exchange code for tokens:",
        tokens.error_description || tokens.error
      );
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    // Fetch user info from Workday
    let userInfo: WorkdayUserInfo | null = null;
    try {
      const userInfoResponse = await fetch(
        `https://${WORKDAY_TENANT}.workday.com/ccx/oauth2/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (userInfoResponse.ok) {
        userInfo = await userInfoResponse.json();
      }
    } catch (err) {
      console.error("Failed to fetch Workday user info:", err);
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Parse scopes
    const scopes = tokens.scope?.split(" ").filter(Boolean) || ["openid", "profile"];

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "workday")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry,
      scopes,
      metadata: {
        tenant: WORKDAY_TENANT,
        workerId: userInfo?.sub,
        name: userInfo?.name,
        email: userInfo?.email,
        username: userInfo?.preferred_username,
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
        provider: "workday",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=workday`);
  } catch (error) {
    console.error("Error in Workday OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
