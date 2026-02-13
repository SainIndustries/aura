import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptToken, decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "expensify";

// GET /api/integrations/expensify - Check connection status
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
      const partnerUserID = decryptToken(integration.accessToken!);
      const partnerUserSecret = integration.refreshToken
        ? decryptToken(integration.refreshToken)
        : null;

      // Expensify uses a unique request format
      const response = await fetch(
        "https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            requestJobDescription: JSON.stringify({
              type: "get",
              credentials: {
                partnerUserID,
                partnerUserSecret,
              },
              inputSettings: {
                type: "policyList",
              },
            }),
          }),
        }
      );

      if (response.ok) {
        const text = await response.text();
        // Expensify returns an error message if credentials are invalid
        if (!text.includes("Error") && !text.includes("error")) {
          isValid = true;
        }
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
    console.error("Error checking Expensify connection:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/expensify - Save credentials
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { partnerUserID, partnerUserSecret } = body;

    if (!partnerUserID || typeof partnerUserID !== "string") {
      return NextResponse.json(
        { error: "Partner User ID is required" },
        { status: 400 }
      );
    }

    if (!partnerUserSecret || typeof partnerUserSecret !== "string") {
      return NextResponse.json(
        { error: "Partner User Secret is required" },
        { status: 400 }
      );
    }

    // Validate credentials by making a test request
    const validationResponse = await fetch(
      "https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          requestJobDescription: JSON.stringify({
            type: "get",
            credentials: {
              partnerUserID,
              partnerUserSecret,
            },
            inputSettings: {
              type: "policyList",
            },
          }),
        }),
      }
    );

    const responseText = await validationResponse.text();

    if (!validationResponse.ok || responseText.includes("Error") || responseText.includes("error")) {
      return NextResponse.json(
        { error: "Invalid credentials. Please check your Partner User ID and Secret." },
        { status: 400 }
      );
    }

    // Parse policies from response
    let policies: { id: string; name: string }[] = [];
    try {
      const data = JSON.parse(responseText);
      if (data.policyList) {
        policies = data.policyList.map((p: { id: string; name: string }) => ({
          id: p.id,
          name: p.name,
        }));
      }
    } catch {
      // Response may not be JSON
    }

    // Encrypt the credentials
    const encryptedPartnerUserID = encryptToken(partnerUserID);
    const encryptedPartnerUserSecret = encryptToken(partnerUserSecret);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    const metadata = {
      partnerUserID: partnerUserID.substring(0, 4) + "***",
      policyCount: policies.length,
      policies: policies.slice(0, 10), // Store first 10 policies
    };

    if (existing) {
      // Update existing integration
      await db
        .update(integrations)
        .set({
          accessToken: encryptedPartnerUserID,
          refreshToken: encryptedPartnerUserSecret,
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
        accessToken: encryptedPartnerUserID,
        refreshToken: encryptedPartnerUserSecret,
        scopes: ["receipts", "reports", "expenses", "policies"],
        metadata,
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving Expensify credentials:", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/expensify - Remove credentials
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
    console.error("Error removing Expensify integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
