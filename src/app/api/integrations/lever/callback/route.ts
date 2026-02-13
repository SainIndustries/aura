import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const LEVER_CLIENT_ID = process.env.LEVER_CLIENT_ID;
const LEVER_CLIENT_SECRET = process.env.LEVER_CLIENT_SECRET;
const LEVER_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/lever/callback`;

interface LeverTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface LeverUser {
  id: string;
  name: string;
  email: string;
  accessRole: string;
  photo?: string;
  createdAt: number;
  deactivatedAt?: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check for OAuth errors
  if (error) {
    console.error("Lever OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=lever_oauth_denied`
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
      "https://auth.lever.co/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: LEVER_CLIENT_ID!,
          client_secret: LEVER_CLIENT_SECRET!,
          code,
          redirect_uri: LEVER_REDIRECT_URI,
        }),
      }
    );

    const tokens: LeverTokenResponse = await tokenResponse.json();

    if (tokens.error || !tokens.access_token) {
      console.error(
        "Failed to exchange code for tokens:",
        tokens.error_description || tokens.error
      );
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    // Fetch current user info
    let leverUser: LeverUser | null = null;
    try {
      const userResponse = await fetch(
        "https://api.lever.co/v1/users/me",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (userResponse.ok) {
        const userData = await userResponse.json();
        leverUser = userData.data;
      }
    } catch (err) {
      console.error("Failed to fetch Lever user:", err);
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Parse scopes
    const scopes = tokens.scope?.split(" ").filter(Boolean) || [
      "offline_access",
      "candidates:read",
      "opportunities:read",
    ];

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "lever")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry,
      scopes,
      metadata: {
        userId: leverUser?.id,
        userName: leverUser?.name,
        email: leverUser?.email,
        accessRole: leverUser?.accessRole,
        photo: leverUser?.photo,
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
        provider: "lever",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=lever`);
  } catch (error) {
    console.error("Error in Lever OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
