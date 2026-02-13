import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const OUTREACH_CLIENT_ID = process.env.OUTREACH_CLIENT_ID;
const OUTREACH_CLIENT_SECRET = process.env.OUTREACH_CLIENT_SECRET;
const OUTREACH_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/outreach/callback`;

interface OutreachTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  created_at: number;
}

interface OutreachUser {
  data: {
    id: number;
    attributes: {
      email: string;
      firstName: string;
      lastName: string;
      name: string;
      title?: string;
    };
  };
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
    console.error("Outreach OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=outreach_oauth_denied`
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
    const tokenResponse = await fetch("https://api.outreach.io/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: OUTREACH_CLIENT_ID!,
        client_secret: OUTREACH_CLIENT_SECRET!,
        redirect_uri: OUTREACH_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Failed to exchange code for tokens:", errorData);
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    const tokens: OutreachTokenResponse = await tokenResponse.json();

    // Fetch current user info
    let userInfo: OutreachUser | null = null;
    try {
      const userResponse = await fetch(
        "https://api.outreach.io/api/v2/users/current",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            "Content-Type": "application/vnd.api+json",
          },
        }
      );
      if (userResponse.ok) {
        userInfo = await userResponse.json();
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
        eq(integrations.provider, "outreach")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry,
      scopes,
      metadata: {
        outreachUserId: userInfo?.data?.id,
        email: userInfo?.data?.attributes?.email,
        name: userInfo?.data?.attributes?.name,
        firstName: userInfo?.data?.attributes?.firstName,
        lastName: userInfo?.data?.attributes?.lastName,
        title: userInfo?.data?.attributes?.title,
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
        provider: "outreach",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=outreach`);
  } catch (error) {
    console.error("Error in Outreach OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
