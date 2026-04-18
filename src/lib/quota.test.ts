import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { FREE_TIER_MONTHLY_LIMIT: 10 },
}));

const subsSelect = vi.fn();
const usersSelect = vi.fn();
const usersUpdate = vi.fn();

vi.mock('@/db', () => {
  const chain = () => {
    const state: { table?: unknown } = {};
    const obj = {
      from(table: unknown) {
        state.table = table;
        return obj;
      },
      where(_clause: unknown) {
        return obj;
      },
      orderBy(_o: unknown) {
        return obj;
      },
      limit(_n: number) {
        const table = state.table as { [k: symbol]: string; name?: string } | undefined;
        const name = table?.[Symbol.for('drizzle:Name') as symbol] ?? table?.name;
        if (name === 'subscriptions') return Promise.resolve(subsSelect());
        if (name === 'users') return Promise.resolve(usersSelect());
        return Promise.resolve([]);
      },
    };
    return obj;
  };

  const db = {
    select: () => chain(),
    update: () => ({
      set: (v: unknown) => ({
        where: (w: unknown) => {
          usersUpdate(v, w);
          return Promise.resolve();
        },
      }),
    }),
  };
  return { db };
});

import { checkAndIncrementQuota } from './quota';

describe('checkAndIncrementQuota — Pro bypass', () => {
  beforeEach(() => {
    subsSelect.mockReset();
    usersSelect.mockReset();
    usersUpdate.mockReset();
  });

  it('returns ok+unlimited without touching the usage counter for Pro users', async () => {
    subsSelect.mockReturnValueOnce([{ id: 'sub-1' }]);

    const result = await checkAndIncrementQuota('user-1');

    expect(result).toEqual({ ok: true, unlimited: true });
    expect(usersSelect).not.toHaveBeenCalled();
    expect(usersUpdate).not.toHaveBeenCalled();
  });

  it('falls through to the free-tier counter when no active sub exists', async () => {
    subsSelect.mockReturnValueOnce([]);
    usersSelect.mockReturnValueOnce([
      { id: 'user-1', count: 3, resetAt: new Date(Date.now() + 86_400_000) },
    ]);

    const result = await checkAndIncrementQuota('user-1');

    expect(result.ok).toBe(true);
    if (result.ok && !result.unlimited) {
      expect(result.remaining).toBe(6);
      expect(result.limit).toBe(10);
    }
    expect(usersUpdate).toHaveBeenCalledTimes(1);
  });
});
