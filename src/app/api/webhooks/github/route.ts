import { NextResponse } from "next/server";
import crypto from "crypto";
import { updateJobStatus, recordHeartbeat, completeProvisioningWithMetadata } from "@/lib/provisioning/queue";
import { rollbackFailedProvision } from "@/lib/provisioning/lifecycle";

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature) return false;

  const secret = process.env.GITHUB_CALLBACK_SECRET;
  if (!secret) {
    console.error("[GitHub Callback] GITHUB_CALLBACK_SECRET not configured");
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  // Use timingSafeEqual to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false; // Different lengths or invalid hex
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-signature");

  // Verify HMAC signature
  if (!verifySignature(body, signature)) {
    console.error("[GitHub Callback] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    job_id: string;
    status?: "provisioning" | "running" | "failed";
    type?: "heartbeat";
    workflow_run_id?: string;
    error?: string;
    failed_step?: string;
    // VM metadata (sent with status=running)
    server_id?: string;
    server_ip?: string;
    tailscale_ip?: string;
  };

  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate required field
  if (!payload.job_id) {
    return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
  }

  try {
    // Handle heartbeat vs status update
    if (payload.type === "heartbeat") {
      await recordHeartbeat(payload.job_id);
      console.log(`[GitHub Callback] Heartbeat for job ${payload.job_id}`);
    } else if (payload.status) {
      // Special handling for "running" status with VM metadata
      if (payload.status === "running" && payload.server_id && payload.server_ip && payload.tailscale_ip) {
        await completeProvisioningWithMetadata({
          jobId: payload.job_id,
          metadata: {
            serverId: payload.server_id,
            serverIp: payload.server_ip,
            tailscaleIp: payload.tailscale_ip,
          },
        });
        console.log(`[GitHub Callback] Job ${payload.job_id} completed with VM metadata: server=${payload.server_id}`);
      } else {
        // Default status update (provisioning, failed, or running without metadata)
        await updateJobStatus({
          jobId: payload.job_id,
          status: payload.status,
          workflowRunId: payload.workflow_run_id,
          error: payload.error,
          failedStep: payload.failed_step,
        });
        console.log(`[GitHub Callback] Job ${payload.job_id} status -> ${payload.status}`);

        // Trigger rollback on failure
        if (payload.status === "failed") {
          try {
            await rollbackFailedProvision(payload.job_id);
            console.log(
              `[GitHub Callback] Rollback completed for failed job ${payload.job_id}`
            );
          } catch (rollbackError) {
            console.error(
              `[GitHub Callback] Rollback failed for job ${payload.job_id}:`,
              rollbackError
            );
            // Log but don't fail the callback response - rollback is best-effort
          }
        }
      }
    } else {
      return NextResponse.json({ error: "Missing status or type" }, { status: 400 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[GitHub Callback] Error processing callback:", error);
    return NextResponse.json(
      { error: "Failed to process callback" },
      { status: 500 }
    );
  }
}
