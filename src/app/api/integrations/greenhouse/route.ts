import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptToken, decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "greenhouse";

interface GreenhouseUser {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  primary_email_address: string;
  site_admin: boolean;
  disabled: boolean;
}

// GET /api/integrations/greenhouse - Check connection status
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

      const response = await fetch(
        "https://harvest.greenhouse.io/v1/users?per_page=1",
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          },
        }
      );

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
    console.error("Error checking Greenhouse connection:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/greenhouse - Save credentials
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
        { error: "API Key is required" },
        { status: 400 }
      );
    }

    // Validate credentials by making a test request
    const validationResponse = await fetch(
      "https://harvest.greenhouse.io/v1/users?per_page=1",
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        },
      }
    );

    if (!validationResponse.ok) {
      return NextResponse.json(
        { error: "Invalid API Key. Please check your Greenhouse Harvest API credentials." },
        { status: 400 }
      );
    }

    const users: GreenhouseUser[] = await validationResponse.json();
    const firstUser = users[0];

    // Get job count for metadata
    let jobCount = 0;
    try {
      const jobsResponse = await fetch(
        "https://harvest.greenhouse.io/v1/jobs?per_page=1",
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          },
        }
      );
      if (jobsResponse.ok) {
        // Check the Link header for total count
        const linkHeader = jobsResponse.headers.get("link");
        if (linkHeader) {
          const match = linkHeader.match(/page=(\d+)>; rel="last"/);
          if (match) {
            jobCount = parseInt(match[1], 10);
          }
        }
        const jobs = await jobsResponse.json();
        if (jobs.length > 0 && jobCount === 0) {
          jobCount = jobs.length;
        }
      }
    } catch {
      // Ignore job count errors
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
      userId: firstUser?.id,
      userName: firstUser?.name,
      email: firstUser?.primary_email_address,
      isSiteAdmin: firstUser?.site_admin,
      jobCount,
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
        scopes: ["jobs", "candidates", "applications", "offers", "scorecards"],
        metadata,
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving Greenhouse credentials:", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/greenhouse - Remove credentials
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
    console.error("Error removing Greenhouse integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
