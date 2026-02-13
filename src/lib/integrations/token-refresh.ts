import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encryptToken, decryptToken } from "./encryption";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

/**
 * Refresh Google OAuth tokens using the refresh token
 */
export async function refreshGoogleToken(integrationId: string): Promise<string | null> {
  try {
    const integration = await db.query.integrations.findFirst({
      where: eq(integrations.id, integrationId),
    });

    if (!integration || integration.provider !== "google" || !integration.refreshToken) {
      console.error("No valid Google integration or refresh token found");
      return null;
    }

    // Decrypt the refresh token
    const refreshToken = decryptToken(integration.refreshToken);

    // Request new access token
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      console.error("Failed to refresh Google token:", await response.text());
      return null;
    }

    const tokens: GoogleTokenResponse = await response.json();
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);
    const encryptedAccessToken = encryptToken(tokens.access_token);

    // Update the integration with new access token
    await db
      .update(integrations)
      .set({
        accessToken: encryptedAccessToken,
        tokenExpiry,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));

    return tokens.access_token;
  } catch (error) {
    console.error("Error refreshing Google token:", error);
    return null;
  }
}

/**
 * Get a valid access token for an integration, refreshing if necessary
 */
export async function getValidAccessToken(
  integrationId: string,
  provider: string
): Promise<string | null> {
  try {
    const integration = await db.query.integrations.findFirst({
      where: eq(integrations.id, integrationId),
    });

    if (!integration || !integration.accessToken) {
      return null;
    }

    // Check if token is expired (for providers that have expiry)
    if (
      integration.tokenExpiry &&
      new Date(integration.tokenExpiry) < new Date()
    ) {
      // Token is expired, try to refresh
      if (provider === "google" && integration.refreshToken) {
        return refreshGoogleToken(integrationId);
      }
      // For providers without refresh, return null (user needs to reconnect)
      return null;
    }

    // Token is still valid, decrypt and return
    return decryptToken(integration.accessToken);
  } catch (error) {
    console.error("Error getting valid access token:", error);
    return null;
  }
}
