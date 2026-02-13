import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/trello/callback`;

// Trello uses OAuth 1.0a but also supports a simpler token-based auth
// For simplicity, we use the authorize endpoint with return_url
// Scopes: read, write, account
const SCOPES = "read,write";

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Trello is configured
    if (!TRELLO_API_KEY) {
      console.error("TRELLO_API_KEY is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=trello_not_configured`
      );
    }

    // Generate state for CSRF protection (stored in callback URL)
    const state = await generateState();

    // Trello uses a different OAuth approach - direct token authorization
    // The callback_method=fragment returns the token as a URL fragment
    const authUrl = new URL("https://trello.com/1/authorize");
    authUrl.searchParams.set("expiration", "never");
    authUrl.searchParams.set("name", "Aura Integration");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("key", TRELLO_API_KEY);
    authUrl.searchParams.set("return_url", `${TRELLO_REDIRECT_URI}?state=${state}`);
    authUrl.searchParams.set("callback_method", "fragment");

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Trello OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
