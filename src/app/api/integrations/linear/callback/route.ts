import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const LINEAR_CLIENT_ID = process.env.LINEAR_CLIENT_ID;
const LINEAR_CLIENT_SECRET = process.env.LINEAR_CLIENT_SECRET;
const LINEAR_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/linear/callback`;

interface LinearTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string[];
  error?: string;
  error_description?: string;
}

interface LinearUser {
  id: string;
  name: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  admin: boolean;
  organization: {
    id: string;
    name: string;
    urlKey: string;
    logoUrl: string | null;
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
    console.error("Linear OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=linear_oauth_denied`
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
    const tokenResponse = await fetch("https://api.linear.app/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: LINEAR_CLIENT_ID!,
        client_secret: LINEAR_CLIENT_SECRET!,
        code,
        redirect_uri: LINEAR_REDIRECT_URI,
      }),
    });

    const tokens: LinearTokenResponse = await tokenResponse.json();

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
    let userInfo: LinearUser | null = null;
    try {
      const userInfoResponse = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query {
              viewer {
                id
                name
                email
                displayName
                avatarUrl
                admin
                organization {
                  id
                  name
                  urlKey
                  logoUrl
                }
              }
            }
          `,
        }),
      });

      if (userInfoResponse.ok) {
        const data = await userInfoResponse.json();
        userInfo = data.data?.viewer;
      }
    } catch (err) {
      console.error("Failed to fetch Linear user info:", err);
    }

    // Encrypt token before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "linear")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: null, // Linear doesn't use refresh tokens for OAuth apps
      tokenExpiry,
      scopes: tokens.scope || ["read", "write"],
      metadata: {
        linearId: userInfo?.id,
        name: userInfo?.name,
        email: userInfo?.email,
        displayName: userInfo?.displayName,
        avatarUrl: userInfo?.avatarUrl,
        isAdmin: userInfo?.admin,
        organization: userInfo?.organization
          ? {
              id: userInfo.organization.id,
              name: userInfo.organization.name,
              urlKey: userInfo.organization.urlKey,
              logoUrl: userInfo.organization.logoUrl,
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
        provider: "linear",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=linear`);
  } catch (error) {
    console.error("Error in Linear OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
