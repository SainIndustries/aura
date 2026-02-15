import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const LINEAR_CLIENT_ID = process.env.LINEAR_CLIENT_ID;
const LINEAR_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/linear/callback`;

// Linear OAuth scopes
const SCOPES = ["read", "write", "issues:create", "comments:create"];

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Linear OAuth is configured
    if (!LINEAR_CLIENT_ID) {
      console.error("LINEAR_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=linear_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState(user.id);

    // Build the Linear OAuth authorization URL
    const authUrl = new URL("https://linear.app/oauth/authorize");
    authUrl.searchParams.set("client_id", LINEAR_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", LINEAR_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES.join(","));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("prompt", "consent");

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Linear OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
