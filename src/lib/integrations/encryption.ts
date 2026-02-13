import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// Use a consistent key derived from a secret
// In production, this should come from a secure environment variable
const ENCRYPTION_KEY =
  process.env.INTEGRATION_ENCRYPTION_KEY || "default-key-change-in-production";

function getKey(): Buffer {
  return scryptSync(ENCRYPTION_KEY, "salt", 32);
}

export function encryptToken(token: string): string {
  const iv = randomBytes(16);
  const key = getKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Return iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = getKey();

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
