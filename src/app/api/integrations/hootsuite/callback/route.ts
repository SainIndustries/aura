import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const HOOTSUITE_CLIENT_ID = process.env.HOOTSUITE_CLIENT_ID;
const HOOTSUITE_CLIENT_SECRET = process.env.HOOTSUITE_CLIENT_SECRET;
const PROVIDER = "hootsuite";

interface HootsuiteTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface HootsuiteUser {
  data: {
    id: string;
    fullName: string;
    email: string;
    language: string;
    timezone: string;
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
    console.error("Hootsuite OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=hootsuite_oauth_denied`
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

    const HOOTSUITE_REDIRECT_URI = `${baseUrl}/api/integrations/hootsuite/callback`;

    // Exchange code for tokens
    const auth = Buffer.from(
      `${HOOTSUITE_CLIENT_ID}:${HOOTSUITE_CLIENT_SECRET}`
    ).toString("base64");

    const tokenResponse = await fetch(
      "https://platform.hootsuite.com/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: HOOTSUITE_REDIRECT_URI,
        }),
      }
    );

    const tokens: HootsuiteTokenResponse = await tokenResponse.json();

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
      "https://platform.hootsuite.com/v1/me",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    let userInfo: HootsuiteUser | null = null;
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
      scopes: ["publishing", "monitoring", "analytics", "streams"],
      metadata: {
        hootsuiteId: userInfo?.data?.id,
        fullName: userInfo?.data?.fullName,
        email: userInfo?.data?.email,
        language: userInfo?.data?.language,
        timezone: userInfo?.data?.timezone,
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

    return NextResponse.redirect(`${baseUrl}/integrations?success=hootsuite`);
  } catch (error) {
    console.error("Error in Hootsuite OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
