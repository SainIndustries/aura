import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID;
const MONDAY_CLIENT_SECRET = process.env.MONDAY_CLIENT_SECRET;
const MONDAY_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/monday/callback`;

interface MondayTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface MondayUser {
  id: string;
  name: string;
  email: string;
  photo_thumb: string | null;
  account: {
    id: string;
    name: string;
    slug: string;
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
    console.error("Monday OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=monday_oauth_denied`
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
    const tokenResponse = await fetch("https://auth.monday.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: MONDAY_CLIENT_ID!,
        client_secret: MONDAY_CLIENT_SECRET!,
        code,
        redirect_uri: MONDAY_REDIRECT_URI,
      }),
    });

    const tokens: MondayTokenResponse = await tokenResponse.json();

    if (tokens.error || !tokens.access_token) {
      console.error(
        "Failed to exchange code for tokens:",
        tokens.error_description || tokens.error
      );
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    // Fetch user info via GraphQL
    let userInfo: MondayUser | null = null;
    try {
      const userInfoResponse = await fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: {
          Authorization: tokens.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query {
              me {
                id
                name
                email
                photo_thumb
                account {
                  id
                  name
                  slug
                }
              }
            }
          `,
        }),
      });

      if (userInfoResponse.ok) {
        const data = await userInfoResponse.json();
        userInfo = data.data?.me;
      }
    } catch (err) {
      console.error("Failed to fetch Monday user info:", err);
    }

    // Encrypt token before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);

    // Monday tokens don't expire by default
    const tokenExpiry = null;

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "monday")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: null,
      tokenExpiry,
      scopes: tokens.scope?.split(" ") || ["boards:read", "boards:write"],
      metadata: {
        mondayId: userInfo?.id,
        name: userInfo?.name,
        email: userInfo?.email,
        avatarUrl: userInfo?.photo_thumb,
        account: userInfo?.account
          ? {
              id: userInfo.account.id,
              name: userInfo.account.name,
              slug: userInfo.account.slug,
            }
          : null,
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
        provider: "monday",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=monday`);
  } catch (error) {
    console.error("Error in Monday OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
