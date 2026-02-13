import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/slack/callback`;

// Slack OAuth scopes
const SCOPES = [
  "channels:read",
  "channels:history",
  "chat:write",
  "users:read",
  "team:read",
  "im:read",
  "im:history",
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

    // Check if Slack OAuth is configured
    if (!SLACK_CLIENT_ID) {
      console.error("SLACK_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=slack_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the Slack OAuth authorization URL
    const authUrl = new URL("https://slack.com/oauth/v2/authorize");
    authUrl.searchParams.set("client_id", SLACK_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", SLACK_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(","));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Slack OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
