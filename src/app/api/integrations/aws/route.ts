import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptToken, decryptToken } from "@/lib/integrations/encryption";

const PROVIDER = "aws";

// GET /api/integrations/aws - Check connection status
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

    // Verify credentials are still valid by calling STS GetCallerIdentity
    let isValid = false;
    let identityInfo = null;
    try {
      const accessKeyId = decryptToken(integration.accessToken!);
      const secretAccessKey = integration.refreshToken
        ? decryptToken(integration.refreshToken)
        : null;

      if (accessKeyId && secretAccessKey) {
        // Create AWS Signature Version 4 signed request
        const response = await callSTSGetCallerIdentity(
          accessKeyId,
          secretAccessKey
        );
        if (response.ok) {
          isValid = true;
          const data = await response.text();
          // Parse XML response
          const accountMatch = data.match(/<Account>([^<]+)<\/Account>/);
          const arnMatch = data.match(/<Arn>([^<]+)<\/Arn>/);
          const userIdMatch = data.match(/<UserId>([^<]+)<\/UserId>/);
          identityInfo = {
            account: accountMatch?.[1],
            arn: arnMatch?.[1],
            userId: userIdMatch?.[1],
          };
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
    console.error("Error checking AWS connection:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/aws - Save credentials
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { accessKeyId, secretAccessKey, region = "us-east-1" } = body;

    if (!accessKeyId || typeof accessKeyId !== "string") {
      return NextResponse.json(
        { error: "AWS Access Key ID is required" },
        { status: 400 }
      );
    }

    if (!secretAccessKey || typeof secretAccessKey !== "string") {
      return NextResponse.json(
        { error: "AWS Secret Access Key is required" },
        { status: 400 }
      );
    }

    // Validate credentials by calling STS GetCallerIdentity
    const validationResponse = await callSTSGetCallerIdentity(
      accessKeyId,
      secretAccessKey
    );

    if (!validationResponse.ok) {
      return NextResponse.json(
        { error: "Invalid credentials. Please check your Access Key ID and Secret Access Key." },
        { status: 400 }
      );
    }

    // Parse identity info from response
    const responseText = await validationResponse.text();
    const accountMatch = responseText.match(/<Account>([^<]+)<\/Account>/);
    const arnMatch = responseText.match(/<Arn>([^<]+)<\/Arn>/);
    const userIdMatch = responseText.match(/<UserId>([^<]+)<\/UserId>/);

    // Encrypt the keys
    const encryptedAccessKey = encryptToken(accessKeyId);
    const encryptedSecretKey = encryptToken(secretAccessKey);

    // Check if integration already exists
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, PROVIDER)
      ),
    });

    const metadata = {
      region,
      account: accountMatch?.[1],
      arn: arnMatch?.[1],
      userId: userIdMatch?.[1],
    };

    if (existing) {
      // Update existing integration
      await db
        .update(integrations)
        .set({
          accessToken: encryptedAccessKey,
          refreshToken: encryptedSecretKey,
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
        accessToken: encryptedAccessKey,
        refreshToken: encryptedSecretKey,
        scopes: ["ec2", "s3", "lambda", "rds", "cloudwatch"],
        metadata,
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { success: true, integration: { id: newIntegration.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving AWS credentials:", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/aws - Remove credentials
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
    console.error("Error removing AWS integration:", error);
    return NextResponse.json(
      { error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}

// Helper function to call AWS STS GetCallerIdentity with Signature V4
async function callSTSGetCallerIdentity(
  accessKeyId: string,
  secretAccessKey: string
): Promise<Response> {
  const host = "sts.amazonaws.com";
  const region = "us-east-1";
  const service = "sts";
  const method = "POST";
  const body = "Action=GetCallerIdentity&Version=2011-06-15";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  // Create canonical request
  const canonicalUri = "/";
  const canonicalQueryString = "";
  const contentType = "application/x-www-form-urlencoded";

  // Create payload hash
  const payloadHash = await sha256(body);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = "content-type;host;x-amz-date";

  const canonicalRequest =
    method +
    "\n" +
    canonicalUri +
    "\n" +
    canonicalQueryString +
    "\n" +
    canonicalHeaders +
    "\n" +
    signedHeaders +
    "\n" +
    payloadHash;

  // Create string to sign
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign =
    algorithm +
    "\n" +
    amzDate +
    "\n" +
    credentialScope +
    "\n" +
    canonicalRequestHash;

  // Calculate signature
  const signingKey = await getSignatureKey(
    secretAccessKey,
    dateStamp,
    region,
    service
  );
  const signature = await hmacHex(signingKey, stringToSign);

  // Create authorization header
  const authorizationHeader =
    `${algorithm} Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(`https://${host}`, {
    method,
    headers: {
      "Content-Type": contentType,
      "X-Amz-Date": amzDate,
      Authorization: authorizationHeader,
    },
    body,
  });
}

// Crypto helpers for AWS Signature V4
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(
  key: BufferSource,
  message: string
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const encoder = new TextEncoder();
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
}

async function hmacHex(key: BufferSource, message: string): Promise<string> {
  const result = await hmac(key, message);
  return Array.from(new Uint8Array(result))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  regionName: string,
  serviceName: string
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await hmac(encoder.encode("AWS4" + secretKey), dateStamp);
  const kRegion = await hmac(kDate, regionName);
  const kService = await hmac(kRegion, serviceName);
  return hmac(kService, "aws4_request");
}
