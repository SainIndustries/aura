import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLogs, agents } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify agent ownership
    const agent = await db.query.agents.findFirst({
      where: and(eq(agents.id, id), eq(agents.userId, user.id)),
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = (page - 1) * limit;

    // Get logs for this specific agent
    const logs = await db
      .select({
        id: auditLogs.id,
        category: auditLogs.category,
        action: auditLogs.action,
        description: auditLogs.description,
        metadata: auditLogs.metadata,
        status: auditLogs.status,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(and(eq(auditLogs.agentId, id), eq(auditLogs.userId, user.id)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(and(eq(auditLogs.agentId, id), eq(auditLogs.userId, user.id)));

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      logs,
      agent: {
        id: agent.id,
        name: agent.name,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Agent logs fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent logs" },
      { status: 500 }
    );
  }
}
