import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const BUFFER_CLIENT_ID = process.env.BUFFER_CLIENT_ID;
const BUFFER_CLIENT_SECRET = process.env.BUFFER_CLIENT_SECRET;
const PROVIDER = "buffer";

interface BufferTokenResponse {
  access_token: string;
  error?: string;
  error_description?: string;
}

interface BufferUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  plan?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check for OAuth errors
  if (error) {
    console.error("Buffer OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=buffer_oauth_denied`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=invalid_callback`
    );
  }

  try {
    // Validate CSRF state
    const isValidState = await validateState(state);
    if (!isValidState) {
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=invalid_state`
      );
    }

    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(`${baseUrl}/sign-in?redirect=/integrations`);
    }

    const BUFFER_REDIRECT_URI = `${baseUrl}/api/integrations/buffer/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch(
      "https://api.bufferapp.com/1/oauth2/token.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: BUFFER_CLIENT_ID!,
          client_secret: BUFFER_CLIENT_SECRET!,
          code,
          redirect_uri: BUFFER_REDIRECT_URI,
        }),
      }
    );

    const tokens: BufferTokenResponse = await tokenResponse.json();

    if (tokens.error || !tokens.access_token) {
      console.error(
        "Failed to exchange code for tokens:",
        tokens.error_description || tokens.error
      );
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=token_exchange_failed`
      );
    }

    // Fetch user info
    const userInfoResponse = await fetch(
      `https://api.bufferapp.com/1/user.json?access_token=${tokens.access_token}`
    );

    let userInfo: BufferUser | null = null;
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json();
    }

    // Encrypt token before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: null, // Buffer tokens don't have refresh tokens
      tokenExpiry: null, // Buffer tokens don't expire
      scopes: ["scheduling", "analytics", "engagement", "start-page"],
      metadata: {
        bufferId: userInfo?.id,
        name: userInfo?.name,
        email: userInfo?.email,
        avatar: userInfo?.avatar,
        plan: userInfo?.plan,
      },
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(integrations)
        .set(integrationData)
        .where(eq(integrations.id, existing.id));
    } else {
      await db.insert(integrations).values({
        userId: user.id,
        provider: PROVIDER,
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=buffer`);
  } catch (error) {
    console.error("Error in Buffer OAuth callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
