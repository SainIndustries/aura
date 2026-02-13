import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID;
const MONDAY_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/monday/callback`;

// Monday.com OAuth scopes
const SCOPES = ["boards:read", "boards:write"];

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Monday OAuth is configured
    if (!MONDAY_CLIENT_ID) {
      console.error("MONDAY_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=monday_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the Monday OAuth authorization URL
    const authUrl = new URL("https://auth.monday.com/oauth2/authorize");
    authUrl.searchParams.set("client_id", MONDAY_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", MONDAY_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Monday OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
