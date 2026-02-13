import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const AIRTABLE_CLIENT_ID = process.env.AIRTABLE_CLIENT_ID;
const AIRTABLE_CLIENT_SECRET = process.env.AIRTABLE_CLIENT_SECRET;
const AIRTABLE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/airtable/callback`;

interface AirtableTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface AirtableUserInfo {
  id: string;
  email?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check for OAuth errors
  if (error) {
    console.error("Airtable OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=airtable_oauth_denied`
    );
  }

  // Validate required parameters
  if (!code || !stateParam) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=invalid_callback`
    );
  }

  try {
    // Parse state to extract CSRF state and code_verifier
    const [state, codeVerifier] = stateParam.split(":");
    
    if (!state || !codeVerifier) {
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=invalid_state`
      );
    }

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

    // Exchange code for tokens (Airtable requires Basic auth)
    const basicAuth = Buffer.from(
      `${AIRTABLE_CLIENT_ID}:${AIRTABLE_CLIENT_SECRET}`
    ).toString("base64");

    const tokenResponse = await fetch("https://airtable.com/oauth2/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: AIRTABLE_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    const tokens: AirtableTokenResponse = await tokenResponse.json();

    if (tokens.error || !tokens.access_token) {
      console.error("Failed to exchange code for tokens:", tokens.error, tokens.error_description);
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    // Fetch user info from Airtable
    let userInfo: AirtableUserInfo | null = null;
    try {
      const userResponse = await fetch("https://api.airtable.com/v0/meta/whoami", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      if (userResponse.ok) {
        userInfo = await userResponse.json();
      }
    } catch (e) {
      console.error("Failed to fetch Airtable user info:", e);
    }

    // Calculate token expiry
    const tokenExpiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Parse scopes
    const scopes = tokens.scope
      ? tokens.scope.split(" ")
      : ["data.records:read", "data.records:write", "schema.bases:read"];

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "airtable")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry,
      scopes,
      metadata: {
        userId: userInfo?.id,
        email: userInfo?.email,
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
        provider: "airtable",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=airtable`);
  } catch (error) {
    console.error("Error in Airtable OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
