import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const OUTREACH_CLIENT_ID = process.env.OUTREACH_CLIENT_ID;
const OUTREACH_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/outreach/callback`;

// Outreach OAuth scopes
const SCOPES = [
  "prospects.all",
  "sequences.all",
  "accounts.all",
  "users.read",
  "tasks.all",
  "calls.all",
  "mailings.all",
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

    // Check if Outreach OAuth is configured
    if (!OUTREACH_CLIENT_ID) {
      console.error("OUTREACH_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=outreach_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState(user.id);

    // Build the Outreach OAuth authorization URL
    const authUrl = new URL("https://api.outreach.io/oauth/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", OUTREACH_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", OUTREACH_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Outreach OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
