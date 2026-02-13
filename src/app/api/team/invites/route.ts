import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teamInvites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";

// GET: List pending invites
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invites = await db.query.teamInvites.findMany({
      where: and(
        eq(teamInvites.workspaceOwnerId, user.id),
        eq(teamInvites.status, "pending")
      ),
      orderBy: (i, { desc }) => [desc(i.createdAt)],
    });

    // Filter out expired invites
    const now = new Date();
    const validInvites = invites.filter((invite) => invite.expiresAt > now);

    return NextResponse.json({ invites: validInvites });
  } catch (error) {
    console.error("Failed to fetch invites:", error);
    return NextResponse.json(
      { error: "Failed to fetch invites" },
      { status: 500 }
    );
  }
}

// DELETE: Revoke invite
export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get("id");

    if (!inviteId) {
      return NextResponse.json(
        { error: "Invite ID is required" },
        { status: 400 }
      );
    }

    // Find the invite
    const invite = await db.query.teamInvites.findFirst({
      where: and(
        eq(teamInvites.id, inviteId),
        eq(teamInvites.workspaceOwnerId, user.id)
      ),
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Update status to revoked
    await db
      .update(teamInvites)
      .set({ status: "revoked" })
      .where(eq(teamInvites.id, inviteId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to revoke invite:", error);
    return NextResponse.json(
      { error: "Failed to revoke invite" },
      { status: 500 }
    );
  }
}
