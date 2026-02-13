import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const MAILCHIMP_CLIENT_ID = process.env.MAILCHIMP_CLIENT_ID;
const MAILCHIMP_CLIENT_SECRET = process.env.MAILCHIMP_CLIENT_SECRET;
const PROVIDER = "mailchimp";

interface MailchimpTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface MailchimpMetadata {
  dc: string;
  user_id: string;
  login: {
    email: string;
    login_name: string;
    login_id: number;
  };
  account_name: string;
  api_endpoint: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check for OAuth errors
  if (error) {
    console.error("Mailchimp OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=mailchimp_oauth_denied`
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

    const MAILCHIMP_REDIRECT_URI = `${baseUrl}/api/integrations/mailchimp/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch(
      "https://login.mailchimp.com/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: MAILCHIMP_CLIENT_ID!,
          client_secret: MAILCHIMP_CLIENT_SECRET!,
          code,
          redirect_uri: MAILCHIMP_REDIRECT_URI,
        }),
      }
    );

    const tokens: MailchimpTokenResponse = await tokenResponse.json();

    if (tokens.error || !tokens.access_token) {
      console.error(
        "Failed to exchange code for tokens:",
        tokens.error_description || tokens.error
      );
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    // Get Mailchimp metadata (including data center)
    const metadataResponse = await fetch(
      "https://login.mailchimp.com/oauth2/metadata",
      {
        headers: {
          Authorization: `OAuth ${tokens.access_token}`,
        },
      }
    );

    let mailchimpMeta: MailchimpMetadata | null = null;
    if (metadataResponse.ok) {
      mailchimpMeta = await metadataResponse.json();
    }

    if (!mailchimpMeta?.dc) {
      console.error("Failed to get Mailchimp metadata");
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=metadata_failed`
      );
    }

    // Encrypt token before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);

    // Calculate token expiry
    const tokenExpiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: null, // Mailchimp tokens don't have refresh tokens
      tokenExpiry,
      scopes: ["campaigns", "audiences", "automations", "templates", "reports"],
      metadata: {
        dc: mailchimpMeta.dc,
        userId: mailchimpMeta.user_id,
        accountName: mailchimpMeta.account_name,
        email: mailchimpMeta.login?.email,
        loginName: mailchimpMeta.login?.login_name,
        apiEndpoint: mailchimpMeta.api_endpoint,
      },
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(integrations)
        .set(integrationData)
        .where(eq(integrations.id, existing.id));
    } else {
      await db.insert(integrations).values({
        userId: user.id,
        provider: PROVIDER,
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=mailchimp`);
  } catch (error) {
    console.error("Error in Mailchimp OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
