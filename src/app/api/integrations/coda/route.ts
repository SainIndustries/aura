import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const CODA_CLIENT_ID = process.env.CODA_CLIENT_ID;
const CODA_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/coda/callback`;

// Coda OAuth scopes
const SCOPES = ["doc:read", "doc:write"];

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Coda OAuth is configured
    if (!CODA_CLIENT_ID) {
      console.error("CODA_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=coda_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the Coda OAuth authorization URL
    const authUrl = new URL("https://coda.io/oauth/authorize");
    authUrl.searchParams.set("client_id", CODA_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", CODA_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Coda OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
