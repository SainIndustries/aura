import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptToken, decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "segment";

// GET /api/integrations/segment - Check connection status
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

    // Verify the write key is still valid
    let isValid = false;
    try {
      const writeKey = decryptToken(integration.accessToken!);
      
      // Test with Segment Tracking API (identify call)
      const auth = Buffer.from(writeKey + ":").toString("base64");
      const response = await fetch("https://api.segment.io/v1/identify", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "test-validation",
          traits: { test: true },
        }),
      });
      isValid = response.ok;
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
    console.error("Error checking Segment connection:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/segment - Save Write Key
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { writeKey, sourceName } = body;

    if (!writeKey || typeof writeKey !== "string") {
      return NextResponse.json(
        { error: "Write Key is required" },
        { status: 400 }
      );
    }

    // Validate the write key by making a test request
    const auth = Buffer.from(writeKey + ":").toString("base64");
    const validationResponse = await fetch("https://api.segment.io/v1/identify", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: "validation-test",
        traits: { _validation: true },
      }),
    });

    if (!validationResponse.ok) {
      return NextResponse.json(
        { error: "Invalid Write Key. Please check and try again." },
        { status: 400 }
      );
    }

    // Encrypt the write key
    const encryptedKey = encryptToken(writeKey);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    const metadata = {
      sourceName: sourceName || "Segment Source",
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
        scopes: ["sources", "destinations", "personas", "protocols"],
        metadata,
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving Segment Write Key:", error);
    return NextResponse.json(
      { error: "Failed to save Write Key" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/segment - Remove Write Key
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
    console.error("Error removing Segment integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
