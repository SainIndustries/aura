import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const WORKDAY_CLIENT_ID = process.env.WORKDAY_CLIENT_ID;
const WORKDAY_TENANT = process.env.WORKDAY_TENANT;
const WORKDAY_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/workday/callback`;

// Workday OAuth scopes - depends on Workday configuration
const SCOPES = ["openid", "profile"];

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Workday OAuth is configured
    if (!WORKDAY_CLIENT_ID || !WORKDAY_TENANT) {
      console.error("WORKDAY_CLIENT_ID or WORKDAY_TENANT is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=workday_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState(user.id);

    // Build the Workday OAuth authorization URL
    // Workday uses tenant-specific URLs
    const authUrl = new URL(
      `https://${WORKDAY_TENANT}.workday.com/ccx/oauth2/authorize`
    );
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", WORKDAY_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", WORKDAY_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Workday OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
