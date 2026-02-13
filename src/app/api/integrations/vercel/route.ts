import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID;
const VERCEL_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/vercel/callback`;

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Vercel OAuth is configured
    if (!VERCEL_CLIENT_ID) {
      console.error("VERCEL_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=vercel_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Build the Vercel OAuth authorization URL
    const authUrl = new URL("https://vercel.com/oauth/authorize");
    authUrl.searchParams.set("client_id", VERCEL_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", VERCEL_REDIRECT_URI);
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Vercel OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
