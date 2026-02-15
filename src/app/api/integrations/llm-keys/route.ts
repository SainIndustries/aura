import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptToken } from "@/lib/integrations/encryption";
import {
  LLM_PROVIDERS,
  isByokProvider,
  type LlmProviderId,
} from "@/lib/integrations/llm-providers";

// GET /api/integrations/llm-keys?provider=openai - Check connection status
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const provider = request.nextUrl.searchParams.get("provider");
    if (!provider || !isByokProvider(provider)) {
      return NextResponse.json(
        { error: "Invalid or missing provider" },
        { status: 400 }
      );
    }

    const providerDef = LLM_PROVIDERS[provider];

    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, providerDef.integrationKey)
      ),
    });

    if (!integration) {
      return NextResponse.json({
        connected: false,
        provider,
      });
    }

    return NextResponse.json({
      connected: true,
      provider,
      connectedAt: integration.connectedAt,
    });
  } catch (error) {
    console.error("Error checking LLM key connection:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/llm-keys - Save API key
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { provider, apiKey } = body;

    if (!provider || !isByokProvider(provider)) {
      return NextResponse.json(
        { error: "Invalid or missing provider" },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    const providerDef = LLM_PROVIDERS[provider];

    // Validate the API key by making a test request
    const { url, headers } = providerDef.buildValidationRequest(apiKey);
    try {
      const validationResponse = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });

      if (!validationResponse.ok) {
        return NextResponse.json(
          { error: "Invalid API key. Please check and try again." },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid API key. Please check and try again." },
        { status: 400 }
      );
    }

    // Encrypt the API key
    const encryptedKey = encryptToken(apiKey);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, providerDef.integrationKey)
      ),
    });

    if (existing) {
      // Update existing integration
      await db
        .update(integrations)
        .set({
          accessToken: encryptedKey,
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
        provider: providerDef.integrationKey,
        accessToken: encryptedKey,
        scopes: ["llm"],
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving LLM API key:", error);
    return NextResponse.json(
      { error: "Failed to save API key" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/llm-keys?provider=openai - Remove API key
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const provider = request.nextUrl.searchParams.get("provider");
    if (!provider || !isByokProvider(provider)) {
      return NextResponse.json(
        { error: "Invalid or missing provider" },
        { status: 400 }
      );
    }

    const providerDef = LLM_PROVIDERS[provider];

    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, providerDef.integrationKey)
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
    console.error("Error removing LLM integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
