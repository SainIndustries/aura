import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/github/callback`;

// GitHub OAuth scopes
const SCOPES = [
  "repo",
  "read:user",
  "read:org",
  "notifications",
];

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if GitHub OAuth is configured
    if (!GITHUB_CLIENT_ID) {
      console.error("GITHUB_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=github_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the GitHub OAuth authorization URL
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", GITHUB_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating GitHub OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
