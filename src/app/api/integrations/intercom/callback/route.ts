import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const INTERCOM_CLIENT_ID = process.env.INTERCOM_CLIENT_ID;
const INTERCOM_CLIENT_SECRET = process.env.INTERCOM_CLIENT_SECRET;

interface IntercomTokenResponse {
  access_token: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface IntercomAdmin {
  type: string;
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  avatar?: {
    type: string;
    image_url: string;
  };
  has_inbox_seat: boolean;
  app: {
    type: string;
    id_code: string;
    name: string;
    region: string;
    timezone: string;
    identity_verification: boolean;
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
    console.error("Intercom OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=intercom_oauth_denied`
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
      "https://api.intercom.io/auth/eagle/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: INTERCOM_CLIENT_ID!,
          client_secret: INTERCOM_CLIENT_SECRET!,
          code,
        }),
      }
    );

    const tokens: IntercomTokenResponse = await tokenResponse.json();

    if (tokens.error || !tokens.access_token) {
      console.error(
        "Failed to exchange code for tokens:",
        tokens.error_description || tokens.error
      );
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    // Fetch admin/user info
    let adminInfo: IntercomAdmin | null = null;
    try {
      const adminResponse = await fetch("https://api.intercom.io/me", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: "application/json",
        },
      });

      if (adminResponse.ok) {
        adminInfo = await adminResponse.json();
      }
    } catch (err) {
      console.error("Failed to fetch Intercom admin info:", err);
    }

    // Encrypt token before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "intercom")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: null, // Intercom access tokens don't expire
      tokenExpiry: null,
      scopes: ["read", "write"],
      metadata: {
        adminId: adminInfo?.id,
        name: adminInfo?.name,
        email: adminInfo?.email,
        emailVerified: adminInfo?.email_verified,
        avatarUrl: adminInfo?.avatar?.image_url,
        hasInboxSeat: adminInfo?.has_inbox_seat,
        app: adminInfo?.app
          ? {
              id: adminInfo.app.id_code,
              name: adminInfo.app.name,
              region: adminInfo.app.region,
              timezone: adminInfo.app.timezone,
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
        provider: "intercom",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=intercom`);
  } catch (error) {
    console.error("Error in Intercom OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
