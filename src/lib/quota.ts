import { and, eq, inArray } from 'drizzle-orm';
import { addMonths, startOfMonth } from 'date-fns';
import { db } from '@/db';
import { subscriptions, users, type Subscription } from '@/db/schema';
import { env } from './env';

const PRO_STATUSES: Subscription['status'][] = ['trialing', 'active', 'past_due'];

export async function isPro(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), inArray(subscriptions.status, PRO_STATUSES)),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Returns the start of the next calendar month at 00:00 local time.
 * Used for monthly usage reset semantics.
 */
export function nextMonthlyReset(now: Date): Date {
  return addMonths(startOfMonth(now), 1);
}

export type QuotaCheck =
  | { ok: true; unlimited: true }
  | { ok: true; unlimited: false; remaining: number; limit: number; resetAt: Date }
  | { ok: false; remaining: 0; limit: number; resetAt: Date };

/**
 * Atomically checks the user's monthly quota and increments usage when allowed.
 * Rolls the counter over when the stored reset timestamp has elapsed.
 * Pro users (trialing/active/past_due sub) bypass the counter entirely.
 */
export async function checkAndIncrementQuota(userId: string): Promise<QuotaCheck> {
  if (await isPro(userId)) {
    return { ok: true, unlimited: true };
  }

  const limit = env.FREE_TIER_MONTHLY_LIMIT;
  const now = new Date();

  const rows = await db
    .select({
      id: users.id,
      count: users.monthlyUsageCount,
      resetAt: users.monthlyUsageResetAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) throw new Error('User not found for quota check');

  const expired = now.getTime() >= user.resetAt.getTime();
  const effectiveCount = expired ? 0 : user.count;
  const effectiveReset = expired ? nextMonthlyReset(now) : user.resetAt;

  if (effectiveCount >= limit) {
    return { ok: false, remaining: 0, limit, resetAt: effectiveReset };
  }

  await db
    .update(users)
    .set({
      monthlyUsageCount: effectiveCount + 1,
      monthlyUsageResetAt: effectiveReset,
    })
    .where(eq(users.id, userId));

  return {
    ok: true,
    unlimited: false,
    remaining: limit - (effectiveCount + 1),
    limit,
    resetAt: effectiveReset,
  };
}

export async function decrementQuota(userId: string): Promise<void> {
  const rows = await db
    .select({ count: users.monthlyUsageCount })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const current = rows[0]?.count ?? 0;
  if (current <= 0) return;

  await db
    .update(users)
    .set({ monthlyUsageCount: current - 1 })
    .where(eq(users.id, userId));
}

export type QuotaStatus =
  | { unlimited: true }
  | { unlimited: false; used: number; limit: number; remaining: number; resetAt: Date };

export async function getQuotaStatus(userId: string): Promise<QuotaStatus> {
  if (await isPro(userId)) {
    return { unlimited: true };
  }

  const rows = await db
    .select({
      count: users.monthlyUsageCount,
      resetAt: users.monthlyUsageResetAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  const limit = env.FREE_TIER_MONTHLY_LIMIT;
  const now = new Date();
  if (!user) {
    return { unlimited: false, used: 0, limit, remaining: limit, resetAt: nextMonthlyReset(now) };
  }

  // If the stored reset has elapsed, show the upcoming reset without mutating
  // state here — the next checkAndIncrementQuota call will persist it.
  const expired = now.getTime() >= user.resetAt.getTime();
  const resetAt = expired ? nextMonthlyReset(now) : user.resetAt;
  const used = expired ? 0 : user.count;

  return {
    unlimited: false,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetAt,
  };
}
