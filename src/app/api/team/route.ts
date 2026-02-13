import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teamMembers, teamInvites, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { randomBytes } from "crypto";

// GET: List team members
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all team members where user is the workspace owner
    const members = await db
      .select({
        id: teamMembers.id,
        userId: teamMembers.userId,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(teamMembers)
      .leftJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.workspaceOwnerId, user.id));

    // Add the owner themselves to the list
    const ownerAsMember = {
      id: "owner",
      userId: user.id,
      role: "owner" as const,
      joinedAt: user.createdAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    };

    return NextResponse.json({
      members: [ownerAsMember, ...members],
    });
  } catch (error) {
    console.error("Failed to fetch team members:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}

// POST: Send invite
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      );
    }

    // Validate role
    if (!["admin", "member", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if user is already a member
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      const existingMember = await db.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.userId, existingUser.id),
          eq(teamMembers.workspaceOwnerId, user.id)
        ),
      });

      if (existingMember) {
        return NextResponse.json(
          { error: "User is already a team member" },
          { status: 400 }
        );
      }

      // Check if it's the owner
      if (existingUser.id === user.id) {
        return NextResponse.json(
          { error: "Cannot invite yourself" },
          { status: 400 }
        );
      }
    }

    // Check for existing pending invite
    const existingInvite = await db.query.teamInvites.findFirst({
      where: and(
        eq(teamInvites.email, email),
        eq(teamInvites.workspaceOwnerId, user.id),
        eq(teamInvites.status, "pending")
      ),
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "An invite has already been sent to this email" },
        { status: 400 }
      );
    }

    // Generate token and expiry
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invite] = await db
      .insert(teamInvites)
      .values({
        workspaceOwnerId: user.id,
        email,
        role,
        token,
        expiresAt,
      })
      .returning();

    // TODO: Send invite email with the token
    // For now, just return the invite details

    return NextResponse.json({ invite });
  } catch (error) {
    console.error("Failed to create invite:", error);
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 }
    );
  }
}
