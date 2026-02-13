import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptToken, decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "stripe";

interface StripeAccount {
  id: string;
  object: string;
  business_profile?: {
    name?: string;
    url?: string;
  };
  business_type?: string;
  email?: string;
  country?: string;
  default_currency?: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
}

// GET /api/integrations/stripe - Check connection status
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
      const secretKey = decryptToken(integration.accessToken!);

      const response = await fetch("https://api.stripe.com/v1/account", {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      });

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
      metadata: {
        ...(integration.metadata as object),
        chargesEnabled: accountInfo?.charges_enabled,
        payoutsEnabled: accountInfo?.payouts_enabled,
      },
    });
  } catch (error) {
    console.error("Error checking Stripe connection:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/stripe - Save credentials
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { secretKey, publishableKey } = body;

    if (!secretKey || typeof secretKey !== "string") {
      return NextResponse.json(
        { error: "Secret Key is required" },
        { status: 400 }
      );
    }

    // Validate the secret key format
    if (!secretKey.startsWith("sk_")) {
      return NextResponse.json(
        { error: "Invalid Secret Key format. It should start with 'sk_'" },
        { status: 400 }
      );
    }

    // Validate credentials by making a test request
    const validationResponse = await fetch(
      "https://api.stripe.com/v1/account",
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    if (!validationResponse.ok) {
      const errorData = await validationResponse.json();
      return NextResponse.json(
        { error: errorData.error?.message || "Invalid Secret Key. Please check your credentials." },
        { status: 400 }
      );
    }

    const accountInfo: StripeAccount = await validationResponse.json();

    // Encrypt the keys
    const encryptedSecretKey = encryptToken(secretKey);
    const encryptedPublishableKey = publishableKey
      ? encryptToken(publishableKey)
      : null;

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    const isLiveMode = secretKey.startsWith("sk_live_");

    const metadata = {
      accountId: accountInfo.id,
      businessName: accountInfo.business_profile?.name,
      businessUrl: accountInfo.business_profile?.url,
      businessType: accountInfo.business_type,
      email: accountInfo.email,
      country: accountInfo.country,
      defaultCurrency: accountInfo.default_currency,
      chargesEnabled: accountInfo.charges_enabled,
      payoutsEnabled: accountInfo.payouts_enabled,
      isLiveMode,
      hasPublishableKey: !!publishableKey,
    };

    if (existing) {
      // Update existing integration
      await db
        .update(integrations)
        .set({
          accessToken: encryptedSecretKey,
          refreshToken: encryptedPublishableKey,
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
        accessToken: encryptedSecretKey,
        refreshToken: encryptedPublishableKey,
        scopes: ["payments", "subscriptions", "invoices", "customers", "reports"],
        metadata,
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving Stripe credentials:", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/stripe - Remove credentials
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
    console.error("Error removing Stripe integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
