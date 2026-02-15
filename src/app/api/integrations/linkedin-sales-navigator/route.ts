import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/linkedin-sales-navigator/callback`;

// LinkedIn Sales Navigator OAuth scopes
const SCOPES = [
  "r_sales_nav_analytics",
  "r_sales_nav_display",
  "r_sales_nav_validation",
  "w_organization_social",
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

    // Check if LinkedIn OAuth is configured
    if (!LINKEDIN_CLIENT_ID) {
      console.error("LINKEDIN_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=linkedin_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState(user.id);

    // Build the LinkedIn OAuth authorization URL
    const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", LINKEDIN_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", LINKEDIN_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating LinkedIn OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
