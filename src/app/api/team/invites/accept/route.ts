import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teamInvites, teamMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";

// POST: Accept invite
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Find the invite
    const invite = await db.query.teamInvites.findFirst({
      where: and(
        eq(teamInvites.token, token),
        eq(teamInvites.status, "pending")
      ),
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid or expired invite" },
        { status: 404 }
      );
    }

    // Check if invite is expired
    if (invite.expiresAt < new Date()) {
      await db
        .update(teamInvites)
        .set({ status: "expired" })
        .where(eq(teamInvites.id, invite.id));

      return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
    }

    // Check if user email matches invite email
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        { error: "This invite was sent to a different email address" },
        { status: 403 }
      );
    }

    // Check if already a member
    const existingMember = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.userId, user.id),
        eq(teamMembers.workspaceOwnerId, invite.workspaceOwnerId)
      ),
    });

    if (existingMember) {
      // Mark invite as accepted anyway
      await db
        .update(teamInvites)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(teamInvites.id, invite.id));

      return NextResponse.json({ error: "Already a team member" }, { status: 400 });
    }

    // Create team member
    const [member] = await db
      .insert(teamMembers)
      .values({
        userId: user.id,
        workspaceOwnerId: invite.workspaceOwnerId,
        role: invite.role,
      })
      .returning();

    // Update invite status
    await db
      .update(teamInvites)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(teamInvites.id, invite.id));

    // Get workspace owner info
    const owner = await db.query.users.findFirst({
      where: eq(users.id, invite.workspaceOwnerId),
    });

    return NextResponse.json({
      member,
      workspace: {
        ownerId: owner?.id,
        ownerName: owner?.name || owner?.email,
      },
    });
  } catch (error) {
    console.error("Failed to accept invite:", error);
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 }
    );
  }
}
