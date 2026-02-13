import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { channelId } = await params;

    const channel = await db.query.channels.findFirst({
      where: and(
        eq(channels.id, channelId),
        eq(channels.userId, user.id)
      ),
      with: {
        agent: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    return NextResponse.json({ channel });
  } catch (error) {
    console.error("Error fetching channel:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { channelId } = await params;
    const body = await request.json();
    const { name, agentId, config, enabled } = body;

    // Check if the channel exists and belongs to the user
    const existingChannel = await db.query.channels.findFirst({
      where: and(
        eq(channels.id, channelId),
        eq(channels.userId, user.id)
      ),
    });

    if (!existingChannel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const [updatedChannel] = await db
      .update(channels)
      .set({
        ...(name !== undefined && { name }),
        ...(agentId !== undefined && { agentId: agentId || null }),
        ...(config !== undefined && { config }),
        ...(enabled !== undefined && { enabled }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.userId, user.id)
        )
      )
      .returning();

    return NextResponse.json({ channel: updatedChannel });
  } catch (error) {
    console.error("Error updating channel:", error);
    return NextResponse.json(
      { error: "Failed to update channel" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { channelId } = await params;

    // Check if the channel exists and belongs to the user
    const existingChannel = await db.query.channels.findFirst({
      where: and(
        eq(channels.id, channelId),
        eq(channels.userId, user.id)
      ),
    });

    if (!existingChannel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    await db
      .delete(channels)
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.userId, user.id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting channel:", error);
    return NextResponse.json(
      { error: "Failed to delete channel" },
      { status: 500 }
    );
  }
}
