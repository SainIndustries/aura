import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const BASECAMP_CLIENT_ID = process.env.BASECAMP_CLIENT_ID;
const BASECAMP_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/basecamp/callback`;

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Basecamp OAuth is configured
    if (!BASECAMP_CLIENT_ID) {
      console.error("BASECAMP_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=basecamp_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState(user.id);

    // Build the Basecamp (37signals) OAuth authorization URL
    const authUrl = new URL("https://launchpad.37signals.com/authorization/new");
    authUrl.searchParams.set("type", "web_server");
    authUrl.searchParams.set("client_id", BASECAMP_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", BASECAMP_REDIRECT_URI);
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Basecamp OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
