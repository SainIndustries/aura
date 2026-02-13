import { db } from ".";
import { users } from "./schema";
import { eq } from "drizzle-orm";

interface PrivyUserData {
  privyUserId: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}

export async function upsertUser(data: PrivyUserData) {
  const existing = await db.query.users.findFirst({
    where: eq(users.privyUserId, data.privyUserId),
  });

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        email: data.email ?? existing.email,
        name: data.name ?? existing.name,
        avatarUrl: data.avatarUrl ?? existing.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.privyUserId, data.privyUserId))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      privyUserId: data.privyUserId,
      email: data.email,
      name: data.name,
      avatarUrl: data.avatarUrl,
    })
    .returning();
  return created;
}
