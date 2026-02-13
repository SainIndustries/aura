import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptToken, decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "sendgrid";

// GET /api/integrations/sendgrid - Check connection status
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

    // Verify the API key is still valid
    let isValid = false;
    try {
      const apiKey = decryptToken(integration.accessToken!);
      
      const response = await fetch("https://api.sendgrid.com/v3/user/profile", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
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
    console.error("Error checking SendGrid connection:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/sendgrid - Save API key
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Validate the API key by making a test request
    const validationResponse = await fetch(
      "https://api.sendgrid.com/v3/user/profile",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!validationResponse.ok) {
      return NextResponse.json(
        { error: "Invalid API key. Please check and try again." },
        { status: 400 }
      );
    }

    const userProfile = await validationResponse.json();

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
      firstName: userProfile.first_name,
      lastName: userProfile.last_name,
      email: userProfile.email,
      company: userProfile.company,
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
        scopes: ["transactional-email", "marketing-campaigns", "templates", "analytics"],
        metadata,
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving SendGrid API key:", error);
    return NextResponse.json(
      { error: "Failed to save API key" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/sendgrid - Remove API key
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
    console.error("Error removing SendGrid integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
