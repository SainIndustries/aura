import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptToken, decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "bamboohr";

interface BambooHREmployee {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  jobTitle?: string;
  department?: string;
}

// GET /api/integrations/bamboohr - Check connection status
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
      const subdomain = (integration.metadata as { subdomain?: string })?.subdomain;

      if (subdomain) {
        const response = await fetch(
          `https://api.bamboohr.com/api/gateway.php/${subdomain}/v1/employees/directory`,
          {
            headers: {
              Authorization: `Basic ${Buffer.from(`${apiKey}:x`).toString("base64")}`,
              Accept: "application/json",
            },
          }
        );

        if (response.ok) {
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
    console.error("Error checking BambooHR connection:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/bamboohr - Save credentials
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { apiKey, subdomain } = body;

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API Key is required" },
        { status: 400 }
      );
    }

    if (!subdomain || typeof subdomain !== "string") {
      return NextResponse.json(
        { error: "Company subdomain is required" },
        { status: 400 }
      );
    }

    // Clean subdomain (remove .bamboohr.com if present)
    const cleanSubdomain = subdomain
      .toLowerCase()
      .replace(".bamboohr.com", "")
      .trim();

    // Validate credentials by making a test request
    const validationResponse = await fetch(
      `https://api.bamboohr.com/api/gateway.php/${cleanSubdomain}/v1/employees/directory`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:x`).toString("base64")}`,
          Accept: "application/json",
        },
      }
    );

    if (!validationResponse.ok) {
      if (validationResponse.status === 401) {
        return NextResponse.json(
          { error: "Invalid API Key. Please check your BambooHR credentials." },
          { status: 400 }
        );
      }
      if (validationResponse.status === 404) {
        return NextResponse.json(
          { error: "Invalid subdomain. Please check your company subdomain." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to validate credentials. Please check your API Key and subdomain." },
        { status: 400 }
      );
    }

    const directoryData = await validationResponse.json();
    const employees: BambooHREmployee[] = directoryData.employees || [];

    // Get company info
    let companyName = cleanSubdomain;
    try {
      const companyResponse = await fetch(
        `https://api.bamboohr.com/api/gateway.php/${cleanSubdomain}/v1/meta/fields/`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${apiKey}:x`).toString("base64")}`,
            Accept: "application/json",
          },
        }
      );
      if (companyResponse.ok) {
        // Company name might be in various places depending on BambooHR setup
      }
    } catch {
      // Ignore company name fetch errors
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
      subdomain: cleanSubdomain,
      companyName,
      employeeCount: employees.length,
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
        scopes: ["employees", "timeoff", "reports", "files", "benefits"],
        metadata,
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving BambooHR credentials:", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/bamboohr - Remove credentials
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
    console.error("Error removing BambooHR integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}
