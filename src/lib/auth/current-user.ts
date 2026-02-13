import { cookies } from "next/headers";
import { getPrivyClient } from "@/lib/privy";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("privy-token")?.value;

    if (!token) return null;

    const privy = getPrivyClient();
    const verifiedClaims = await privy.verifyAuthToken(token);

    const user = await db.query.users.findFirst({
      where: eq(users.privyUserId, verifiedClaims.userId),
    });

    return user ?? null;
  } catch {
    return null;
  }
}
