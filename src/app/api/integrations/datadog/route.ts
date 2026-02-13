import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptToken, decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "datadog";

// GET /api/integrations/datadog - Check connection status
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
    let accountInfo = null;
    try {
      const metadata = integration.metadata as { site?: string };
      const apiKey = decryptToken(integration.accessToken!);
      const applicationKey = integration.refreshToken
        ? decryptToken(integration.refreshToken)
        : null;
      const site = metadata.site || "datadoghq.com";

      const response = await fetch(
        `https://api.${site}/api/v1/validate`,
        {
          headers: {
            "DD-API-KEY": apiKey,
            ...(applicationKey && { "DD-APPLICATION-KEY": applicationKey }),
          },
        }
      );

      if (response.ok) {
        isValid = true;
        accountInfo = await response.json();
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
    console.error("Error checking Datadog connection:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/datadog - Save credentials
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { apiKey, applicationKey, site = "datadoghq.com" } = body;

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API Key is required" },
        { status: 400 }
      );
    }

    // Validate credentials by making a test request
    const validationResponse = await fetch(
      `https://api.${site}/api/v1/validate`,
      {
        headers: {
          "DD-API-KEY": apiKey,
          ...(applicationKey && { "DD-APPLICATION-KEY": applicationKey }),
        },
      }
    );

    if (!validationResponse.ok) {
      return NextResponse.json(
        { error: "Invalid credentials. Please check your API Key and Application Key." },
        { status: 400 }
      );
    }

    const validationData = await validationResponse.json();

    // Encrypt the keys
    const encryptedApiKey = encryptToken(apiKey);
    const encryptedApplicationKey = applicationKey
      ? encryptToken(applicationKey)
      : null;

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    const metadata = {
      site,
      valid: validationData.valid,
    };

    if (existing) {
      // Update existing integration
      await db
        .update(integrations)
        .set({
          accessToken: encryptedApiKey,
          refreshToken: encryptedApplicationKey,
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
        accessToken: encryptedApiKey,
        refreshToken: encryptedApplicationKey,
        scopes: ["metrics", "logs", "apm", "alerts", "dashboards"],
        metadata,
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving Datadog credentials:", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/datadog - Remove credentials
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
    console.error("Error removing Datadog integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
