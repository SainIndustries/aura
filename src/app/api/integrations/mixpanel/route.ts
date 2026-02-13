import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptToken, decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "mixpanel";

// GET /api/integrations/mixpanel - Check connection status
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

    // Verify the API key is still valid by making a test request
    let isValid = false;
    try {
      const apiKey = decryptToken(integration.accessToken!);
      const metadata = integration.metadata as { projectId: string };
      
      // Test with Mixpanel Query API
      const response = await fetch(
        `https://mixpanel.com/api/2.0/engage?project_id=${metadata.projectId}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
            Accept: "application/json",
          },
        }
      );
      isValid = response.ok || response.status === 400; // 400 is okay, means auth worked
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
    console.error("Error checking Mixpanel connection:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/mixpanel - Save API key
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { apiKey, projectId } = body;

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Validate the API key by making a test request
    const validationResponse = await fetch(
      `https://mixpanel.com/api/2.0/engage?project_id=${projectId}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
          Accept: "application/json",
        },
      }
    );

    // Mixpanel returns 400 for empty query but auth is valid, 401 for bad auth
    if (validationResponse.status === 401) {
      return NextResponse.json(
        { error: "Invalid API key or Project ID. Please check and try again." },
        { status: 400 }
      );
    }

    // Encrypt the API key
    const encryptedKey = encryptToken(apiKey);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    const metadata = {
      projectId,
    };

    if (existing) {
      await db
        .update(integrations)
        .set({
          accessToken: encryptedKey,
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id));

      return NextResponse.json({ success: true, updated: true });
    }

    const [newIntegration] = await db
      .insert(integrations)
      .values({
        userId: user.id,
        provider: PROVIDER,
        accessToken: encryptedKey,
        scopes: ["events", "funnels", "retention", "cohorts"],
        metadata,
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving Mixpanel API key:", error);
    return NextResponse.json(
      { error: "Failed to save API key" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/mixpanel - Remove API key
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
    console.error("Error removing Mixpanel integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
