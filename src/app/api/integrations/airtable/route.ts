import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateState } from "@/lib/integrations/oauth-state";
import * as crypto from "crypto";

const AIRTABLE_CLIENT_ID = process.env.AIRTABLE_CLIENT_ID;
const AIRTABLE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/airtable/callback`;

// Airtable OAuth scopes
const SCOPES = ["data.records:read", "data.records:write", "schema.bases:read"];

// Generate PKCE code verifier and challenge
function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?redirect=/integrations`
      );
    }

    // Check if Airtable OAuth is configured
    if (!AIRTABLE_CLIENT_ID) {
      console.error("AIRTABLE_CLIENT_ID is not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=airtable_not_configured`
      );
    }

    // Generate state for CSRF protection
    const state = await generateState();

    // Generate PKCE values (Airtable requires PKCE)
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Build the Airtable OAuth authorization URL
    const authUrl = new URL("https://airtable.com/oauth2/v1/authorize");
    authUrl.searchParams.set("client_id", AIRTABLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", AIRTABLE_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", `${state}:${codeVerifier}`); // Include code_verifier in state
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Airtable OAuth:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_failed`
    );
  }
}
