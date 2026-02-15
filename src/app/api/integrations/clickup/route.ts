import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const CLICKUP_CLIENT_ID = process.env.CLICKUP_CLIENT_ID;
const CLICKUP_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/clickup/callback`;

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if ClickUp OAuth is configured
    if (!CLICKUP_CLIENT_ID) {
      console.error("CLICKUP_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=clickup_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState(user.id);

    // Build the ClickUp OAuth authorization URL
    const authUrl = new URL("https://app.clickup.com/api");
    authUrl.searchParams.set("client_id", CLICKUP_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", CLICKUP_REDIRECT_URI);
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating ClickUp OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
