import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const GONG_CLIENT_ID = process.env.GONG_CLIENT_ID;
const GONG_CLIENT_SECRET = process.env.GONG_CLIENT_SECRET;
const GONG_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/gong/callback`;

interface GongTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GongUser {
  id: string;
  emailAddress: string;
  firstName: string;
  lastName: string;
  title?: string;
  phoneNumber?: string;
  managerId?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check for OAuth errors
  if (error) {
    console.error("Gong OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=gong_oauth_denied`
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
    // Gong uses Basic auth for token endpoint
    const basicAuth = Buffer.from(
      `${GONG_CLIENT_ID}:${GONG_CLIENT_SECRET}`
    ).toString("base64");

    const tokenResponse = await fetch("https://app.gong.io/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: GONG_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Failed to exchange code for tokens:", errorData);
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    const tokens: GongTokenResponse = await tokenResponse.json();

    // Fetch current user info
    let userInfo: GongUser | null = null;
    try {
      const userResponse = await fetch("https://api.gong.io/v2/users/me", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      if (userResponse.ok) {
        const userData = await userResponse.json();
        userInfo = userData.users?.[0] || null;
      }
    } catch {
      // User info is optional
    }

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = encryptToken(tokens.refresh_token);

    // Parse scopes
    const scopes = tokens.scope ? tokens.scope.split(" ") : [];

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "gong")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry,
      scopes,
      metadata: {
        gongUserId: userInfo?.id,
        email: userInfo?.emailAddress,
        firstName: userInfo?.firstName,
        lastName: userInfo?.lastName,
        name: userInfo
          ? `${userInfo.firstName || ""} ${userInfo.lastName || ""}`.trim()
          : undefined,
        title: userInfo?.title,
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
        provider: "gong",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=gong`);
  } catch (error) {
    console.error("Error in Gong OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
