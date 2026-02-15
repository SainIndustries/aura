import { randomBytes, createHmac } from "crypto";
import { cookies } from "next/headers";

const STATE_COOKIE_NAME = "oauth_state";
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function getHmacKey(): string {
  return process.env.INTEGRATION_ENCRYPTION_KEY || "fallback-key";
}

/**
 * Generate an OAuth state that embeds the userId (and optional agentId) with HMAC signature.
 * Format: nonce:userId:agentId:sig  (agentId may be empty string)
 * This avoids depending on auth cookies surviving the cross-site redirect.
 */
export async function generateState(userId: string, agentId?: string): Promise<string> {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${nonce}:${userId}:${agentId ?? ""}`;
  const sig = createHmac("sha256", getHmacKey()).update(payload).digest("hex");
  const state = `${payload}:${sig}`;

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_EXPIRY_MS / 1000,
    path: "/",
  });

  return state;
}

/**
 * Validate state and extract userId + optional agentId.
 * Checks HMAC signature and cookie nonce.
 * Returns { userId, agentId? } if valid, null otherwise.
 */
export async function validateState(state: string): Promise<{ userId: string; agentId?: string } | null> {
  const parts = state.split(":");
  // Format: nonce:userId:agentId:sig (agentId may be empty)
  if (parts.length !== 4) return null;

  const [nonce, userId, agentId, sig] = parts;

  // Verify HMAC signature
  const payload = `${nonce}:${userId}:${agentId}`;
  const expectedSig = createHmac("sha256", getHmacKey()).update(payload).digest("hex");
  if (sig !== expectedSig) return null;

  // Verify cookie nonce (may be absent after cross-site redirect, so treat as optional)
  const cookieStore = await cookies();
  const storedNonce = cookieStore.get(STATE_COOKIE_NAME)?.value;
  cookieStore.delete(STATE_COOKIE_NAME);

  // If cookie is present, it must match
  if (storedNonce && storedNonce !== nonce) return null;

  return { userId, agentId: agentId || undefined };
}
