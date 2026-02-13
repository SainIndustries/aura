import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLogs, agents } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { eq, and, desc, gte, lte, ilike, or, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const agentId = searchParams.get("agentId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");

    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions = [eq(auditLogs.userId, user.id)];

    if (category && category !== "all") {
      conditions.push(
        eq(
          auditLogs.category,
          category as
            | "agent"
            | "communication"
            | "calendar"
            | "pipeline"
            | "integration"
            | "system"
            | "billing"
        )
      );
    }

    if (status && status !== "all") {
      conditions.push(eq(auditLogs.status, status));
    }

    if (agentId && agentId !== "all") {
      conditions.push(eq(auditLogs.agentId, agentId));
    }

    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogs.createdAt, end));
    }

    if (search) {
      conditions.push(
        or(
          ilike(auditLogs.action, `%${search}%`),
          ilike(auditLogs.description, `%${search}%`)
        )!
      );
    }

    const whereClause = and(...conditions);

    // Get logs with agent info
    const logs = await db
      .select({
        id: auditLogs.id,
        category: auditLogs.category,
        action: auditLogs.action,
        description: auditLogs.description,
        metadata: auditLogs.metadata,
        status: auditLogs.status,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
        agentId: auditLogs.agentId,
        agentName: agents.name,
      })
      .from(auditLogs)
      .leftJoin(agents, eq(auditLogs.agentId, agents.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause);

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      logs,
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
    console.error("Audit log fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
