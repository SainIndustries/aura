import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels, users } from "@/lib/db/schema";
import { getPrivyClient } from "@/lib/privy";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("privy-token")?.value;

  if (!token) {
    return null;
  }

  try {
    const privy = getPrivyClient();
    const verifiedClaims = await privy.verifyAuthToken(token);
    
    const user = await db.query.users.findFirst({
      where: eq(users.privyUserId, verifiedClaims.userId),
    });

    return user;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userChannels = await db.query.channels.findMany({
      where: eq(channels.userId, user.id),
      with: {
        agent: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: (channels, { desc }) => [desc(channels.createdAt)],
    });

    return NextResponse.json({ channels: userChannels });
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { type, name, agentId, config, enabled } = body;

    if (!type || !name) {
      return NextResponse.json(
        { error: "Type and name are required" },
        { status: 400 }
      );
    }

    const validTypes = ["web", "slack", "telegram", "whatsapp", "discord", "email"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid channel type" },
        { status: 400 }
      );
    }

    const [channel] = await db
      .insert(channels)
      .values({
        userId: user.id,
        agentId: agentId || null,
        type,
        name,
        enabled: enabled ?? true,
        config: config || {},
        connectedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json(
      { error: "Failed to create channel" },
      { status: 500 }
    );
  }
}
