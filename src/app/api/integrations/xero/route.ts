import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
const XERO_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/xero/callback`;

// Xero OAuth scopes
const SCOPES = ["openid", "profile", "email", "accounting.transactions", "offline_access"];

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Xero OAuth is configured
    if (!XERO_CLIENT_ID) {
      console.error("XERO_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=xero_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the Xero OAuth authorization URL
    const authUrl = new URL(
      "https://login.xero.com/identity/connect/authorize"
    );
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", XERO_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", XERO_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Xero OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
