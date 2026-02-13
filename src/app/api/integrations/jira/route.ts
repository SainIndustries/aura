import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const JIRA_CLIENT_ID = process.env.JIRA_CLIENT_ID;
const JIRA_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/jira/callback`;

// Atlassian/Jira OAuth scopes
const SCOPES = [
  "read:jira-user",
  "read:jira-work",
  "write:jira-work",
  "manage:jira-project",
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

    // Check if Jira OAuth is configured
    if (!JIRA_CLIENT_ID) {
      console.error("JIRA_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=jira_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the Atlassian OAuth authorization URL
    const authUrl = new URL("https://auth.atlassian.com/authorize");
    authUrl.searchParams.set("audience", "api.atlassian.com");
    authUrl.searchParams.set("client_id", JIRA_CLIENT_ID);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("redirect_uri", JIRA_REDIRECT_URI);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("prompt", "consent");

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Jira OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
