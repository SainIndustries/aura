import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const GONG_CLIENT_ID = process.env.GONG_CLIENT_ID;
const GONG_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/gong/callback`;

// Gong OAuth scopes
const SCOPES = [
  "api:calls:read:basic",
  "api:calls:read:extensive",
  "api:users:read",
  "api:stats:read",
  "api:library:read",
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

    // Check if Gong OAuth is configured
    if (!GONG_CLIENT_ID) {
      console.error("GONG_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=gong_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState(user.id);

    // Build the Gong OAuth authorization URL
    const authUrl = new URL("https://app.gong.io/oauth2/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", GONG_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", GONG_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Gong OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
