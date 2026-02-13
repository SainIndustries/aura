import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptToken, decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "sentry";

interface SentryUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  dateJoined: string;
  isSuperuser: boolean;
}

interface SentryOrg {
  id: string;
  name: string;
  slug: string;
  dateCreated: string;
  status: {
    id: string;
    name: string;
  };
}

// GET /api/integrations/sentry - Check connection status
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    if (!integration) {
      return NextResponse.json({
        connected: false,
        provider: PROVIDER,
      });
    }

    // Verify credentials are still valid by making a test request
    let isValid = false;
    try {
      const authToken = decryptToken(integration.accessToken!);

      const response = await fetch("https://sentry.io/api/0/", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        isValid = true;
      }
    } catch {
      isValid = false;
    }

    return NextResponse.json({
      connected: true,
      provider: PROVIDER,
      connectedAt: integration.connectedAt,
      isValid,
      metadata: integration.metadata,
    });
  } catch (error) {
    console.error("Error checking Sentry connection:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/sentry - Save credentials
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { authToken, organizationSlug } = body;

    if (!authToken || typeof authToken !== "string") {
      return NextResponse.json(
        { error: "Auth Token is required" },
        { status: 400 }
      );
    }

    // Validate credentials by fetching user info
    const userResponse = await fetch("https://sentry.io/api/0/", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "Invalid Auth Token. Please check your credentials." },
        { status: 400 }
      );
    }

    const sentryData: { user: SentryUser } = await userResponse.json();
    const sentryUser = sentryData.user;

    // Fetch organizations
    let organizations: SentryOrg[] = [];
    try {
      const orgsResponse = await fetch(
        "https://sentry.io/api/0/organizations/",
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (orgsResponse.ok) {
        organizations = await orgsResponse.json();
      }
    } catch (err) {
      console.error("Failed to fetch Sentry organizations:", err);
    }

    // Encrypt the auth token
    const encryptedAuthToken = encryptToken(authToken);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    const metadata = {
      userId: sentryUser.id,
      name: sentryUser.name,
      email: sentryUser.email,
      avatarUrl: sentryUser.avatarUrl,
      isSuperuser: sentryUser.isSuperuser,
      organizationSlug,
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
      })),
    };

    if (existing) {
      // Update existing integration
      await db
        .update(integrations)
        .set({
          accessToken: encryptedAuthToken,
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id));

      return NextResponse.json({ success: true, updated: true });
    }

    // Create new integration
    const [newIntegration] = await db
      .insert(integrations)
      .values({
        userId: user.id,
        provider: PROVIDER,
        accessToken: encryptedAuthToken,
        scopes: ["errors", "performance", "releases", "alerts", "issues"],
        metadata,
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving Sentry credentials:", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/sentry - Remove credentials
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    await db.delete(integrations).where(eq(integrations.id, integration.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing Sentry integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
