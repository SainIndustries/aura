import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID;
const VERCEL_CLIENT_SECRET = process.env.VERCEL_CLIENT_SECRET;
const VERCEL_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/vercel/callback`;

interface VercelTokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  team_id?: string;
  error?: string;
  error_description?: string;
}

interface VercelUser {
  id: string;
  email: string;
  name: string;
  username: string;
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
    console.error("Vercel OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=vercel_oauth_denied`
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
      "https://api.vercel.com/v2/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: VERCEL_CLIENT_ID!,
          client_secret: VERCEL_CLIENT_SECRET!,
          code,
          redirect_uri: VERCEL_REDIRECT_URI,
        }),
      }
    );

    const tokens: VercelTokenResponse = await tokenResponse.json();

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
    const userInfoResponse = await fetch("https://api.vercel.com/v2/user", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    let userInfo: VercelUser | null = null;
    if (userInfoResponse.ok) {
      const userData = await userInfoResponse.json();
      userInfo = userData.user;
    }

    // Encrypt token before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);

    // Vercel tokens don't expire
    const scopes = ["deployments", "domains", "projects", "analytics"];

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "vercel")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: null, // Vercel tokens don't have refresh tokens
      tokenExpiry: null, // Vercel tokens don't expire
      scopes,
      metadata: {
        vercelUserId: tokens.user_id,
        teamId: tokens.team_id,
        email: userInfo?.email,
        name: userInfo?.name,
        username: userInfo?.username,
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
        provider: "vercel",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=vercel`);
  } catch (error) {
    console.error("Error in Vercel OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
