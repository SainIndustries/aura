import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/linkedin-sales-navigator/callback`;

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
  token_type: string;
}

interface LinkedInProfile {
  id: string;
  localizedFirstName?: string;
  localizedLastName?: string;
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
    console.error("LinkedIn OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=linkedin_oauth_denied`
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
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: LINKEDIN_CLIENT_ID!,
          client_secret: LINKEDIN_CLIENT_SECRET!,
          redirect_uri: LINKEDIN_REDIRECT_URI,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Failed to exchange code for tokens:", errorData);
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    const tokens: LinkedInTokenResponse = await tokenResponse.json();

    // Fetch user profile
    let profile: LinkedInProfile | null = null;
    try {
      const profileResponse = await fetch("https://api.linkedin.com/v2/me", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      if (profileResponse.ok) {
        profile = await profileResponse.json();
      }
    } catch {
      // Profile info is optional
    }

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Parse scopes
    const scopes = tokens.scope ? tokens.scope.split(" ") : [];

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "linkedin-sales-navigator")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry,
      scopes,
      metadata: {
        linkedInId: profile?.id,
        firstName: profile?.localizedFirstName,
        lastName: profile?.localizedLastName,
        name: profile
          ? `${profile.localizedFirstName || ""} ${profile.localizedLastName || ""}`.trim()
          : undefined,
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
        provider: "linkedin-sales-navigator",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(
      `${baseUrl}/integrations?success=linkedin-sales-navigator`
    );
  } catch (error) {
    console.error("Error in LinkedIn OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
