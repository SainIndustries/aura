import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const CLICKUP_CLIENT_ID = process.env.CLICKUP_CLIENT_ID;
const CLICKUP_CLIENT_SECRET = process.env.CLICKUP_CLIENT_SECRET;

interface ClickUpTokenResponse {
  access_token: string;
  token_type: string;
  error?: string;
}

interface ClickUpUser {
  id: number;
  username: string;
  email: string;
  color: string;
  profilePicture: string | null;
  initials: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check for OAuth errors
  if (error) {
    console.error("ClickUp OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=clickup_oauth_denied`
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
      "https://api.clickup.com/api/v2/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: CLICKUP_CLIENT_ID,
          client_secret: CLICKUP_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokens: ClickUpTokenResponse = await tokenResponse.json();

    if (tokens.error || !tokens.access_token) {
      console.error("Failed to exchange code for tokens:", tokens.error);
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    // Fetch user info
    let userInfo: ClickUpUser | null = null;
    try {
      const userInfoResponse = await fetch(
        "https://api.clickup.com/api/v2/user",
        {
          headers: {
            Authorization: tokens.access_token,
          },
        }
      );

      if (userInfoResponse.ok) {
        const data = await userInfoResponse.json();
        userInfo = data.user;
      }
    } catch (err) {
      console.error("Failed to fetch ClickUp user info:", err);
    }

    // Encrypt token before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);

    // ClickUp tokens don't expire by default
    const tokenExpiry = null;

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "clickup")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: null,
      tokenExpiry,
      scopes: ["read", "write"],
      metadata: {
        clickupId: userInfo?.id?.toString(),
        username: userInfo?.username,
        email: userInfo?.email,
        color: userInfo?.color,
        profilePicture: userInfo?.profilePicture,
        initials: userInfo?.initials,
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
        provider: "clickup",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=clickup`);
  } catch (error) {
    console.error("Error in ClickUp OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
