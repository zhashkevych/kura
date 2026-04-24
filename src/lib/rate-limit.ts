import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { summaries } from '@/db/schema';
import { env } from '@/lib/env';

export type RateLimitResult =
  | { ok: true; hourCount: number; dayCount: number }
  | {
      ok: false;
      reason: 'hour' | 'day';
      limit: number;
      retryAfterSeconds: number;
    };

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

/**
 * Counts how many summary jobs this user has kicked off recently.
 * `summaries.updatedAt` is bumped by the POST, reuse, and retry paths right
 * before `processSummary` runs — so a single count captures every billable
 * invocation in the window, including retries that reuse an existing row.
 *
 * Fails open on DB errors: the surrounding request path also needs the DB,
 * so a transient outage will surface as a 500 from the main insert anyway;
 * locking users out on top of that helps no one.
 */
export async function checkSummaryRateLimit(userId: string): Promise<RateLimitResult> {
  const hourLimit = env.SUMMARY_RATE_LIMIT_HOUR;
  const dayLimit = env.SUMMARY_RATE_LIMIT_DAY;

  const now = new Date();
  const hourCutoff = new Date(now.getTime() - HOUR_SECONDS * 1000);
  const dayCutoff = new Date(now.getTime() - DAY_SECONDS * 1000);

  let hourCount: number;
  let dayCount: number;
  try {
    const [row] = await db
      .select({
        hourCount: sql<number>`count(*) filter (where ${summaries.updatedAt} > ${hourCutoff})`,
        dayCount: sql<number>`count(*) filter (where ${summaries.updatedAt} > ${dayCutoff})`,
      })
      .from(summaries)
      .where(and(eq(summaries.userId, userId), gt(summaries.updatedAt, dayCutoff)));

    hourCount = Number(row?.hourCount ?? 0);
    dayCount = Number(row?.dayCount ?? 0);
  } catch (err) {
    console.error('[rate-limit] count query failed, failing open:', err);
    return { ok: true, hourCount: 0, dayCount: 0 };
  }

  if (dayCount >= dayLimit) {
    const oldest = await oldestUpdatedAtInWindow(userId, dayCutoff);
    const retryAfterSeconds = secondsUntilWindowReopens(oldest, DAY_SECONDS, now);
    return { ok: false, reason: 'day', limit: dayLimit, retryAfterSeconds };
  }

  if (hourCount >= hourLimit) {
    const oldest = await oldestUpdatedAtInWindow(userId, hourCutoff);
    const retryAfterSeconds = secondsUntilWindowReopens(oldest, HOUR_SECONDS, now);
    return { ok: false, reason: 'hour', limit: hourLimit, retryAfterSeconds };
  }

  return { ok: true, hourCount, dayCount };
}

async function oldestUpdatedAtInWindow(userId: string, cutoff: Date): Promise<Date | null> {
  try {
    const [row] = await db
      .select({ updatedAt: summaries.updatedAt })
      .from(summaries)
      .where(and(eq(summaries.userId, userId), gt(summaries.updatedAt, cutoff)))
      .orderBy(summaries.updatedAt)
      .limit(1);
    return row?.updatedAt ?? null;
  } catch {
    return null;
  }
}

function secondsUntilWindowReopens(
  oldest: Date | null,
  windowSeconds: number,
  now: Date,
): number {
  if (!oldest) return windowSeconds;
  const reopensAt = oldest.getTime() + windowSeconds * 1000;
  const delta = Math.ceil((reopensAt - now.getTime()) / 1000);
  return Math.max(1, Math.min(windowSeconds, delta));
}

export function formatRateLimitError(result: Extract<RateLimitResult, { ok: false }>): string {
  const minutes = Math.ceil(result.retryAfterSeconds / 60);
  const window = result.reason === 'hour' ? 'hour' : 'day';
  if (minutes >= 60) {
    const hours = Math.ceil(minutes / 60);
    return `Rate limit reached (${result.limit} per ${window}). Try again in ~${hours}h.`;
  }
  return `Rate limit reached (${result.limit} per ${window}). Try again in ~${minutes} min.`;
}

export type SummaryUsage = {
  hour: { used: number; limit: number; resetsAt: Date | null };
  day: { used: number; limit: number; resetsAt: Date | null };
};

/**
 * Read-only counterpart to `checkSummaryRateLimit`: returns current usage
 * against both windows for display in the UI. `resetsAt` is when the oldest
 * in-window row ages out (i.e. when `used` drops by one); `null` if nothing
 * has been counted yet.
 */
export async function getSummaryUsage(userId: string): Promise<SummaryUsage> {
  const hourLimit = env.SUMMARY_RATE_LIMIT_HOUR;
  const dayLimit = env.SUMMARY_RATE_LIMIT_DAY;

  const now = new Date();
  const hourCutoff = new Date(now.getTime() - HOUR_SECONDS * 1000);
  const dayCutoff = new Date(now.getTime() - DAY_SECONDS * 1000);

  try {
    const [row] = await db
      .select({
        hourCount: sql<number>`count(*) filter (where ${summaries.updatedAt} > ${hourCutoff})`,
        dayCount: sql<number>`count(*) filter (where ${summaries.updatedAt} > ${dayCutoff})`,
      })
      .from(summaries)
      .where(and(eq(summaries.userId, userId), gt(summaries.updatedAt, dayCutoff)));

    const hourCount = Number(row?.hourCount ?? 0);
    const dayCount = Number(row?.dayCount ?? 0);

    const [oldestHour, oldestDay] = await Promise.all([
      hourCount > 0 ? oldestUpdatedAtInWindow(userId, hourCutoff) : Promise.resolve(null),
      dayCount > 0 ? oldestUpdatedAtInWindow(userId, dayCutoff) : Promise.resolve(null),
    ]);

    return {
      hour: {
        used: hourCount,
        limit: hourLimit,
        resetsAt: oldestHour ? new Date(oldestHour.getTime() + HOUR_SECONDS * 1000) : null,
      },
      day: {
        used: dayCount,
        limit: dayLimit,
        resetsAt: oldestDay ? new Date(oldestDay.getTime() + DAY_SECONDS * 1000) : null,
      },
    };
  } catch (err) {
    console.error('[rate-limit] usage query failed:', err);
    return {
      hour: { used: 0, limit: hourLimit, resetsAt: null },
      day: { used: 0, limit: dayLimit, resetsAt: null },
    };
  }
}
