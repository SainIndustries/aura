import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptToken, decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "1password";

// GET /api/integrations/1password - Check connection status
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

    // Verify the Connect Server token is still valid
    let isValid = false;
    try {
      const metadata = integration.metadata as { connectHost: string };
      const token = decryptToken(integration.accessToken!);
      
      const response = await fetch(`${metadata.connectHost}/v1/vaults`, {
        headers: {
          Authorization: `Bearer ${token}`,
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
      metadata: {
        connectHost: (integration.metadata as { connectHost: string })?.connectHost,
      },
    });
  } catch (error) {
    console.error("Error checking 1Password connection:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/1password - Save Connect Server credentials
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { connectHost, connectToken } = body;

    if (!connectHost || typeof connectHost !== "string") {
      return NextResponse.json(
        { error: "Connect Server host is required" },
        { status: 400 }
      );
    }

    if (!connectToken || typeof connectToken !== "string") {
      return NextResponse.json(
        { error: "Connect Server token is required" },
        { status: 400 }
      );
    }

    // Normalize the host URL
    const normalizedHost = connectHost.replace(/\/$/, "");

    // Validate the credentials by making a test request
    const validationResponse = await fetch(`${normalizedHost}/v1/vaults`, {
      headers: {
        Authorization: `Bearer ${connectToken}`,
      },
    });

    if (!validationResponse.ok) {
      return NextResponse.json(
        { error: "Invalid credentials or Connect Server unreachable. Please check and try again." },
        { status: 400 }
      );
    }

    const vaults = await validationResponse.json();

    // Encrypt the token
    const encryptedToken = encryptToken(connectToken);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    const metadata = {
      connectHost: normalizedHost,
      vaultCount: Array.isArray(vaults) ? vaults.length : 0,
    };

    if (existing) {
      await db
        .update(integrations)
        .set({
          accessToken: encryptedToken,
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
        accessToken: encryptedToken,
        scopes: ["vaults", "items", "secrets", "events"],
        metadata,
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving 1Password credentials:", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/1password - Remove credentials
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
    console.error("Error removing 1Password integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
