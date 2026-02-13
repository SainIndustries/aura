import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const LEVER_CLIENT_ID = process.env.LEVER_CLIENT_ID;
const LEVER_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/lever/callback`;

// Lever OAuth scopes
const SCOPES = ["offline_access", "candidates:read", "opportunities:read", "postings:read", "users:read"];

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Lever OAuth is configured
    if (!LEVER_CLIENT_ID) {
      console.error("LEVER_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=lever_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the Lever OAuth authorization URL
    const authUrl = new URL("https://auth.lever.co/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", LEVER_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", LEVER_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("audience", "https://api.lever.co/v1/");

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Lever OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
