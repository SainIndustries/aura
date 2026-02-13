import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/salesforce/callback`;

// Salesforce OAuth scopes
const SCOPES = ["api", "refresh_token", "offline_access"];

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Salesforce OAuth is configured
    if (!SALESFORCE_CLIENT_ID) {
      console.error("SALESFORCE_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=salesforce_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the Salesforce OAuth authorization URL
    const authUrl = new URL(
      "https://login.salesforce.com/services/oauth2/authorize"
    );
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", SALESFORCE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", SALESFORCE_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Salesforce OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
