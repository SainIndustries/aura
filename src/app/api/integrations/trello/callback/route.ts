import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validateState } from "@/lib/integrations/oauth-state";
import { encryptToken } from "@/lib/integrations/encryption";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;

interface TrelloMember {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  avatarUrl: string | null;
  url: string;
}

// Trello returns the token as a URL fragment (#token=xxx)
// We need a client-side page to capture it and send to the server
// This route handles both:
// 1. Initial redirect from Trello (renders client page to capture fragment)
// 2. POST request from client with the actual token

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get("state");
  const token = searchParams.get("token"); // If token is passed as query param

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // If we have the token directly (passed from client), process it
  if (token && state) {
    return handleTokenExchange(token, state);
  }

  // Otherwise, render a page that captures the URL fragment and posts it
  // Trello sends: callback#token=xxx
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Connecting Trello...</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #e5e5e5;
            border-top-color: #0079bf;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <p>Connecting your Trello account...</p>
        </div>
        <script>
          (function() {
            // Extract token from URL fragment
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const token = params.get('token');
            
            // Get state from query params
            const urlParams = new URLSearchParams(window.location.search);
            const state = urlParams.get('state');
            
            if (token && state) {
              // Redirect with token as query param
              window.location.href = '/api/integrations/trello/callback?token=' + 
                encodeURIComponent(token) + '&state=' + encodeURIComponent(state);
            } else {
              // No token found - redirect with error
              window.location.href = '/integrations?error=trello_no_token';
            }
          })();
        </script>
      </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}

async function handleTokenExchange(token: string, state: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

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

    // Fetch user info from Trello
    let userInfo: TrelloMember | null = null;
    try {
      const userInfoResponse = await fetch(
        `https://api.trello.com/1/members/me?key=${TRELLO_API_KEY}&token=${token}`,
        { method: "GET" }
      );

      if (userInfoResponse.ok) {
        userInfo = await userInfoResponse.json();
      }
    } catch (err) {
      console.error("Failed to fetch Trello user info:", err);
    }

    // Encrypt token before storing
    const encryptedAccessToken = encryptToken(token);

    // Trello tokens with "never" expiration don't expire
    const tokenExpiry = null;

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, "trello")
      ),
    });

    const integrationData = {
      accessToken: encryptedAccessToken,
      refreshToken: null,
      tokenExpiry,
      scopes: ["read", "write"],
      metadata: {
        trelloId: userInfo?.id,
        username: userInfo?.username,
        fullName: userInfo?.fullName,
        email: userInfo?.email,
        avatarUrl: userInfo?.avatarUrl,
        profileUrl: userInfo?.url,
      },
      updatedAt: new Date(),
    };

    if (existing) {
      // Update existing integration
      await db
        .update(integrations)
        .set(integrationData)
        .where(eq(integrations.id, existing.id));
    } else {
      // Create new integration
      await db.insert(integrations).values({
        userId: user.id,
        provider: "trello",
        ...integrationData,
        connectedAt: new Date(),
      });
    }

    return NextResponse.redirect(`${baseUrl}/integrations?success=trello`);
  } catch (error) {
    console.error("Error in Trello callback:", error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=callback_failed`
    );
  }
}
