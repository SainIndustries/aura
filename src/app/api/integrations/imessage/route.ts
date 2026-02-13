import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptToken, decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "imessage";

// iMessage uses bridge services like BlueBubbles or AirMessage
interface iMessageBridgeInfo {
  server_name?: string;
  version?: string;
  os_version?: string;
  private_api?: boolean;
}

// GET /api/integrations/imessage - Check connection status
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
      const apiKey = decryptToken(integration.accessToken!);
      const baseUrl = integration.metadata?.baseUrl || "http://localhost:1234";

      // BlueBubbles API endpoint for server info
      const response = await fetch(`${baseUrl}/api/v1/server/info`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
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
    console.error("Error checking iMessage connection:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/imessage - Save credentials
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { apiKey, baseUrl = "http://localhost:1234" } = body;

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API Key is required" },
        { status: 400 }
      );
    }

    // Validate credentials by making a test request to iMessage bridge
    let bridgeInfo: iMessageBridgeInfo | null = null;
    try {
      const validationResponse = await fetch(`${baseUrl}/api/v1/server/info`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!validationResponse.ok) {
        return NextResponse.json(
          { error: "Invalid API Key or iMessage bridge not reachable." },
          { status: 400 }
        );
      }

      const data = await validationResponse.json();
      bridgeInfo = data.data || data;
    } catch (error) {
      // If bridge is not available, still allow saving for later validation
      console.warn("iMessage bridge not reachable, saving credentials anyway:", error);
    }

    // Encrypt the API key
    const encryptedApiKey = encryptToken(apiKey);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    const metadata = {
      baseUrl,
      serverName: bridgeInfo?.server_name,
      version: bridgeInfo?.version,
      osVersion: bridgeInfo?.os_version,
      privateApi: bridgeInfo?.private_api,
    };

    if (existing) {
      // Update existing integration
      await db
        .update(integrations)
        .set({
          accessToken: encryptedApiKey,
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
        scopes: ["messages", "group_chats", "media", "reactions"],
        metadata,
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving iMessage credentials:", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/imessage - Remove credentials
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
    console.error("Error removing iMessage integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
