import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/hubspot/callback`;

// HubSpot OAuth scopes for CRM access
const SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.schemas.contacts.read",
  "crm.schemas.companies.read",
  "crm.schemas.deals.read",
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

    // Check if HubSpot OAuth is configured
    if (!HUBSPOT_CLIENT_ID) {
      console.error("HUBSPOT_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=hubspot_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState(user.id);

    // Build the HubSpot OAuth authorization URL
    const authUrl = new URL("https://app.hubspot.com/oauth/authorize");
    authUrl.searchParams.set("client_id", HUBSPOT_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", HUBSPOT_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating HubSpot OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
