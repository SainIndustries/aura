import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/microsoft-teams/callback`;

// Microsoft Graph API scopes for Teams
const SCOPES = [
  "User.Read",
  "Chat.ReadWrite",
  "Channel.ReadBasic.All",
  "Team.ReadBasic.All",
  "ChannelMessage.Send",
  "offline_access",
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

    // Check if Microsoft OAuth is configured
    if (!MICROSOFT_CLIENT_ID) {
      console.error("MICROSOFT_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=microsoft_teams_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the Microsoft OAuth authorization URL
    const authUrl = new URL(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    );
    authUrl.searchParams.set("client_id", MICROSOFT_CLIENT_ID);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", MICROSOFT_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_mode", "query");

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Microsoft Teams OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
