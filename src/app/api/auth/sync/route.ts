import { NextResponse } from "next/server";
import { getPrivyClient } from "@/lib/privy";
import { upsertUser } from "@/lib/db/user-sync";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("privy-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const privy = getPrivyClient();
    const verifiedClaims = await privy.verifyAuthToken(token);
    const privyUser = await privy.getUser(verifiedClaims.userId);

    const user = await upsertUser({
      privyUserId: privyUser.id,
      email: privyUser.email?.address,
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Auth sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync user" },
      { status: 500 }
    );
  }
}
