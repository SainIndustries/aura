import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const BASECAMP_CLIENT_ID = process.env.BASECAMP_CLIENT_ID;
const BASECAMP_CLIENT_SECRET = process.env.BASECAMP_CLIENT_SECRET;
const BASECAMP_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/basecamp/callback`;

interface BasecampTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

interface BasecampIdentity {
  id: number;
  first_name: string;
  last_name: string;
  email_address: string;
  avatar_url: string;
}

interface BasecampAccount {
  id: number;
  name: string;
  href: string;
  product: string;
}

interface BasecampAuthorizationResponse {
  identity: BasecampIdentity;
  accounts: BasecampAccount[];
  expires_at: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check for OAuth errors
  if (error) {
    console.error("Basecamp OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=basecamp_oauth_denied`
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
      "https://launchpad.37signals.com/authorization/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          type: "web_server",
          client_id: BASECAMP_CLIENT_ID!,
          client_secret: BASECAMP_CLIENT_SECRET!,
          redirect_uri: BASECAMP_REDIRECT_URI,
          code,
        }),
      }
    );

    const tokens: BasecampTokenResponse = await tokenResponse.json();

    if (tokens.error || !tokens.access_token) {
      console.error(
        "Failed to exchange code for tokens:",
        tokens.error_description || tokens.error
      );
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    // Fetch user authorization info (identity + accounts)
    let authInfo: BasecampAuthorizationResponse | null = null;
    try {
      const authResponse = await fetch(
        "https://launchpad.37signals.com/authorization.json",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (authResponse.ok) {
        authInfo = await authResponse.json();
      }
    } catch (err) {
      console.error("Failed to fetch Basecamp authorization info:", err);
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
        eq(integrations.provider, "basecamp")
      ),
    });

    // Get the first Basecamp account (usually the main one)
    const primaryAccount = authInfo?.accounts?.find(
      (a) => a.product === "bc3" || a.product === "basecamp"
    ) || authInfo?.accounts?.[0];

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry,
      scopes: ["read", "write"],
      metadata: {
        basecampId: authInfo?.identity?.id?.toString(),
        firstName: authInfo?.identity?.first_name,
        lastName: authInfo?.identity?.last_name,
        fullName: authInfo?.identity
          ? `${authInfo.identity.first_name} ${authInfo.identity.last_name}`
          : null,
        email: authInfo?.identity?.email_address,
        avatarUrl: authInfo?.identity?.avatar_url,
        accounts: authInfo?.accounts?.map((a) => ({
          id: a.id,
          name: a.name,
          product: a.product,
          href: a.href,
        })),
        primaryAccount: primaryAccount
          ? {
              id: primaryAccount.id,
              name: primaryAccount.name,
              product: primaryAccount.product,
              href: primaryAccount.href,
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
        provider: "basecamp",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=basecamp`);
  } catch (error) {
    console.error("Error in Basecamp OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
