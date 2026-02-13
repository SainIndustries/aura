import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const INTERCOM_CLIENT_ID = process.env.INTERCOM_CLIENT_ID;
const INTERCOM_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/intercom/callback`;

// Intercom OAuth scopes
const SCOPES = ["read", "write"];

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Intercom OAuth is configured
    if (!INTERCOM_CLIENT_ID) {
      console.error("INTERCOM_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=intercom_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the Intercom OAuth authorization URL
    const authUrl = new URL("https://app.intercom.com/oauth");
    authUrl.searchParams.set("client_id", INTERCOM_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", INTERCOM_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Intercom OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
