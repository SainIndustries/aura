// ---------------------------------------------------------------------------
// Token guard — check and deduct token balance before LLM calls
// ---------------------------------------------------------------------------

import { db } from "@/lib/db";
import { tokenBalances } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export interface TokenCheckResult {
  allowed: boolean;
  remainingBalance: number;
  message?: string;
}

/**
 * Atomically check if the user has enough tokens and deduct them.
 * Returns { allowed: false } if the balance is insufficient.
 */
export async function checkAndDeductTokens(
  userId: string,
  tokenCount: number
): Promise<TokenCheckResult> {
  // Atomic check-and-decrement: only updates if balance >= tokenCount
  const result = await db
    .update(tokenBalances)
    .set({
      balance: sql`${tokenBalances.balance} - ${tokenCount}`,
      totalUsed: sql`${tokenBalances.totalUsed} + ${tokenCount}`,
      updatedAt: new Date(),
    })
    .where(
      sql`${tokenBalances.userId} = ${userId} AND ${tokenBalances.balance} >= ${tokenCount}`
    )
    .returning({ balance: tokenBalances.balance });

  if (result.length === 0) {
    // Not enough tokens — fetch current balance for the error response
    const current = await db.query.tokenBalances.findFirst({
      where: eq(tokenBalances.userId, userId),
    });
    return {
      allowed: false,
      remainingBalance: current?.balance ?? 0,
      message:
        "You've used all your tokens. Purchase a top-up pack to continue.",
    };
  }

  return {
    allowed: true,
    remainingBalance: result[0].balance,
  };
}

/**
 * Correct the balance after getting actual token count from the LLM response.
 * Call this when the actual usage differs from the estimate.
 */
export async function adjustTokenUsage(
  userId: string,
  estimatedTokens: number,
  actualTokens: number
): Promise<void> {
  const diff = actualTokens - estimatedTokens;
  if (diff === 0) return;

  if (diff > 0) {
    // Used more than estimated — deduct the difference
    await db
      .update(tokenBalances)
      .set({
        balance: sql`GREATEST(${tokenBalances.balance} - ${diff}, 0)`,
        totalUsed: sql`${tokenBalances.totalUsed} + ${diff}`,
        updatedAt: new Date(),
      })
      .where(eq(tokenBalances.userId, userId));
  } else {
    // Used less than estimated — refund the difference
    const refund = Math.abs(diff);
    await db
      .update(tokenBalances)
      .set({
        balance: sql`${tokenBalances.balance} + ${refund}`,
        totalUsed: sql`${tokenBalances.totalUsed} - ${refund}`,
        updatedAt: new Date(),
      })
      .where(eq(tokenBalances.userId, userId));
  }
}

/**
 * Get the current token balance for a user.
 */
export async function getTokenBalance(userId: string) {
  const record = await db.query.tokenBalances.findFirst({
    where: eq(tokenBalances.userId, userId),
  });

  if (!record) {
    return {
      balance: 0,
      monthlyAllocation: 0,
      totalUsed: 0,
      totalPurchased: 0,
      percentUsed: 100,
    };
  }

  const percentUsed =
    record.monthlyAllocation > 0
      ? Math.round(
          ((record.monthlyAllocation - record.balance) /
            record.monthlyAllocation) *
            100
        )
      : 0;

  return {
    balance: record.balance,
    monthlyAllocation: record.monthlyAllocation,
    totalUsed: record.totalUsed,
    totalPurchased: record.totalPurchased,
    percentUsed: Math.min(percentUsed, 100),
  };
}

/**
 * Grant tokens to a user (for subscription start, renewal, or top-up).
 */
export async function grantTokens(
  userId: string,
  tokens: number,
  isMonthlyReset: boolean = false
): Promise<void> {
  const existing = await db.query.tokenBalances.findFirst({
    where: eq(tokenBalances.userId, userId),
  });

  if (existing) {
    if (isMonthlyReset) {
      // Monthly reset: set balance to allocation (don't accumulate)
      await db
        .update(tokenBalances)
        .set({
          balance: tokens,
          monthlyAllocation: tokens,
          lastResetAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tokenBalances.userId, userId));
    } else {
      // Top-up: add to existing balance
      await db
        .update(tokenBalances)
        .set({
          balance: sql`${tokenBalances.balance} + ${tokens}`,
          totalPurchased: sql`${tokenBalances.totalPurchased} + ${tokens}`,
          updatedAt: new Date(),
        })
        .where(eq(tokenBalances.userId, userId));
    }
  } else {
    // First time — create the balance record
    await db.insert(tokenBalances).values({
      userId,
      balance: tokens,
      monthlyAllocation: tokens,
      lastResetAt: new Date(),
    });
  }
}
