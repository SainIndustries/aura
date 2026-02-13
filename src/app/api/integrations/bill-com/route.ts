import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const BILL_COM_CLIENT_ID = process.env.BILL_COM_CLIENT_ID;
const BILL_COM_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/bill-com/callback`;

// Bill.com OAuth scopes
const SCOPES = ["offline_access"];

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Bill.com OAuth is configured
    if (!BILL_COM_CLIENT_ID) {
      console.error("BILL_COM_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=billcom_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the Bill.com OAuth authorization URL
    const authUrl = new URL("https://app.bill.com/oauth2/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", BILL_COM_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", BILL_COM_REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Bill.com OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
