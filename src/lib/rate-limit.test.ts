import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnv = {
  SUMMARY_RATE_LIMIT_HOUR: 5,
  SUMMARY_RATE_LIMIT_DAY: 20,
};

vi.mock('@/lib/env', () => ({
  get env() {
    return mockEnv;
  },
}));

type QueueEntry = unknown[] | Error;
const queue: QueueEntry[] = [];

function makeBuilder(resolve: () => Promise<unknown[]>): unknown {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    then: (onFulfilled: (value: unknown[]) => unknown, onRejected?: (reason: unknown) => unknown) =>
      resolve().then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => resolve().catch(onRejected),
  };
  return builder;
}

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() =>
      makeBuilder(async () => {
        const next = queue.shift();
        if (next instanceof Error) throw next;
        return next ?? [];
      }),
    ),
  },
}));

import { checkSummaryRateLimit, formatRateLimitError, getSummaryUsage } from './rate-limit';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function enqueueCount(hourCount: number, dayCount: number) {
  queue.push([{ hourCount, dayCount }]);
}

function enqueueOldest(updatedAt: Date | null) {
  queue.push(updatedAt ? [{ updatedAt }] : []);
}

beforeEach(() => {
  mockEnv.SUMMARY_RATE_LIMIT_HOUR = 5;
  mockEnv.SUMMARY_RATE_LIMIT_DAY = 20;
  queue.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checkSummaryRateLimit', () => {
  it('allows requests below both limits', async () => {
    enqueueCount(2, 5);
    const result = await checkSummaryRateLimit(USER_ID);
    expect(result).toEqual({ ok: true, hourCount: 2, dayCount: 5 });
  });

  it('allows a request exactly one under the hour limit', async () => {
    enqueueCount(4, 4);
    const result = await checkSummaryRateLimit(USER_ID);
    expect(result.ok).toBe(true);
  });

  it('blocks when the hour count is at the limit', async () => {
    vi.setSystemTime(new Date('2026-04-24T12:00:00Z'));
    enqueueCount(5, 10);
    enqueueOldest(new Date('2026-04-24T11:30:00Z'));
    const result = await checkSummaryRateLimit(USER_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('hour');
    expect(result.limit).toBe(5);
    // Oldest-in-window was at T-30min. Window reopens at T+30min → ~1800s.
    expect(result.retryAfterSeconds).toBeGreaterThan(1700);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(1800);
  });

  it('blocks when the day count is at the limit even if hour is fine', async () => {
    vi.setSystemTime(new Date('2026-04-24T12:00:00Z'));
    enqueueCount(1, 20);
    enqueueOldest(new Date('2026-04-24T02:00:00Z'));
    const result = await checkSummaryRateLimit(USER_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('day');
    expect(result.limit).toBe(20);
    // Oldest at T-10h. Window reopens at T+14h.
    expect(result.retryAfterSeconds).toBeGreaterThan(14 * 3600 - 5);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(24 * 3600);
  });

  it('prefers the day reason when both windows are exhausted', async () => {
    enqueueCount(10, 25);
    enqueueOldest(new Date(Date.now() - 3600 * 1000 * 12));
    const result = await checkSummaryRateLimit(USER_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('day');
  });

  it('honors env-driven limit overrides', async () => {
    mockEnv.SUMMARY_RATE_LIMIT_HOUR = 2;
    enqueueCount(2, 2);
    enqueueOldest(new Date(Date.now() - 600 * 1000));
    const result = await checkSummaryRateLimit(USER_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('hour');
    expect(result.limit).toBe(2);
  });

  it('fails open on DB errors', async () => {
    queue.push(new Error('boom'));
    const result = await checkSummaryRateLimit(USER_ID);
    expect(result).toEqual({ ok: true, hourCount: 0, dayCount: 0 });
  });

  it('uses full window when oldest lookup returns nothing', async () => {
    enqueueCount(5, 5);
    enqueueOldest(null);
    const result = await checkSummaryRateLimit(USER_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.retryAfterSeconds).toBe(3600);
  });
});

describe('getSummaryUsage', () => {
  it('returns zeroed counts and null resets when the user has no history', async () => {
    enqueueCount(0, 0);
    const usage = await getSummaryUsage(USER_ID);
    expect(usage).toEqual({
      hour: { used: 0, limit: 5, resetsAt: null },
      day: { used: 0, limit: 20, resetsAt: null },
    });
  });

  it('projects resetsAt from the oldest-in-window timestamp for each window', async () => {
    vi.setSystemTime(new Date('2026-04-24T12:00:00Z'));
    const oldestHour = new Date('2026-04-24T11:30:00Z');
    const oldestDay = new Date('2026-04-24T02:00:00Z');
    enqueueCount(3, 8);
    // hour lookup first, then day lookup (Promise.all preserves arg order)
    queue.push([{ updatedAt: oldestHour }]);
    queue.push([{ updatedAt: oldestDay }]);

    const usage = await getSummaryUsage(USER_ID);
    expect(usage.hour.used).toBe(3);
    expect(usage.hour.resetsAt?.toISOString()).toBe('2026-04-24T12:30:00.000Z');
    expect(usage.day.used).toBe(8);
    expect(usage.day.resetsAt?.toISOString()).toBe('2026-04-25T02:00:00.000Z');
  });

  it('returns a safe zeroed snapshot on DB errors', async () => {
    queue.push(new Error('nope'));
    const usage = await getSummaryUsage(USER_ID);
    expect(usage.hour).toEqual({ used: 0, limit: 5, resetsAt: null });
    expect(usage.day).toEqual({ used: 0, limit: 20, resetsAt: null });
  });
});

describe('formatRateLimitError', () => {
  it('formats sub-hour waits in minutes', () => {
    expect(
      formatRateLimitError({ ok: false, reason: 'hour', limit: 5, retryAfterSeconds: 600 }),
    ).toBe('Rate limit reached (5 per hour). Try again in ~10 min.');
  });

  it('formats multi-hour waits in hours', () => {
    expect(
      formatRateLimitError({ ok: false, reason: 'day', limit: 20, retryAfterSeconds: 7200 }),
    ).toBe('Rate limit reached (20 per day). Try again in ~2h.');
  });
});
