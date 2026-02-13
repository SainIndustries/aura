import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const ZENDESK_CLIENT_ID = process.env.ZENDESK_CLIENT_ID;
const ZENDESK_CLIENT_SECRET = process.env.ZENDESK_CLIENT_SECRET;

interface ZendeskTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

interface ZendeskUser {
  id: number;
  name: string;
  email: string;
  role: string;
  photo?: {
    content_url: string;
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
    console.error("Zendesk OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=zendesk_oauth_denied`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=invalid_callback`
    );
  }

  try {
    // Parse state to get the original state and subdomain
    const [originalState, subdomain] = state.split(":");

    if (!subdomain) {
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=invalid_state`
      );
    }

    // Validate CSRF state
    const isValidState = await validateState(originalState);
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

    const ZENDESK_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/zendesk/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch(
      `https://${subdomain}.zendesk.com/oauth/tokens`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: ZENDESK_CLIENT_ID,
          client_secret: ZENDESK_CLIENT_SECRET,
          code,
          redirect_uri: ZENDESK_REDIRECT_URI,
          scope: "read write",
        }),
      }
    );

    const tokens: ZendeskTokenResponse = await tokenResponse.json();

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
    let userInfo: ZendeskUser | null = null;
    try {
      const userInfoResponse = await fetch(
        `https://${subdomain}.zendesk.com/api/v2/users/me`,
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (userInfoResponse.ok) {
        const data = await userInfoResponse.json();
        userInfo = data.user;
      }
    } catch (err) {
      console.error("Failed to fetch Zendesk user info:", err);
    }

    // Encrypt token before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);

    // Parse scopes
    const scopes = tokens.scope?.split(" ").filter(Boolean) || ["read", "write"];

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "zendesk")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: null,
      tokenExpiry: null, // Zendesk OAuth tokens don't expire
      scopes,
      metadata: {
        subdomain,
        userId: userInfo?.id,
        name: userInfo?.name,
        email: userInfo?.email,
        role: userInfo?.role,
        avatarUrl: userInfo?.photo?.content_url,
        authType: "oauth",
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
        provider: "zendesk",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=zendesk`);
  } catch (error) {
    console.error("Error in Zendesk OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
