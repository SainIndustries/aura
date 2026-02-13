import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const BITBUCKET_CLIENT_ID = process.env.BITBUCKET_CLIENT_ID;
const BITBUCKET_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/bitbucket/callback`;

// Bitbucket OAuth scopes
const SCOPES = ["repository", "pullrequest"];

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Bitbucket OAuth is configured
    if (!BITBUCKET_CLIENT_ID) {
      console.error("BITBUCKET_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=bitbucket_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the Bitbucket OAuth authorization URL
    const authUrl = new URL("https://bitbucket.org/site/oauth2/authorize");
    authUrl.searchParams.set("client_id", BITBUCKET_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", BITBUCKET_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Bitbucket OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
