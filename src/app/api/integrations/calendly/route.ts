import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const CALENDLY_CLIENT_ID = process.env.CALENDLY_CLIENT_ID;
const CALENDLY_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/calendly/callback`;

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Calendly OAuth is configured
    if (!CALENDLY_CLIENT_ID) {
      console.error("CALENDLY_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=calendly_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the Calendly OAuth authorization URL
    const authUrl = new URL("https://auth.calendly.com/oauth/authorize");
    authUrl.searchParams.set("client_id", CALENDLY_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", CALENDLY_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Calendly OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
