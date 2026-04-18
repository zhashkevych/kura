import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_x',
    STRIPE_PRICE_MONTHLY: 'price_monthly_x',
    STRIPE_PRICE_YEARLY: 'price_yearly_x',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

const processedInsert = vi.fn();
const upsertSub = vi.fn();

vi.mock('@/db', () => ({
  db: {
    insert: (_table: unknown) => ({
      values: (payload: unknown) => ({
        onConflictDoNothing: () => ({
          returning: () => processedInsert(payload),
        }),
      }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  },
}));

vi.mock('@/lib/billing/subscription-sync', () => ({
  upsertSubscriptionFromStripe: (sub: unknown) => upsertSub(sub),
}));

const constructEvent = vi.fn();
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: (...args: unknown[]) => constructEvent(...args),
    },
  },
}));

import { POST } from './route';

function buildRequest(body: string) {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1,v1=dead', 'content-type': 'application/json' },
    body,
  });
}

const SUB_EVENT = {
  id: 'evt_test_1',
  type: 'customer.subscription.created',
  data: {
    object: {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'trialing',
      cancel_at_period_end: false,
      trial_end: null,
      metadata: { userId: 'u1' },
      items: { data: [] },
    },
  },
};

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    processedInsert.mockReset();
    upsertSub.mockReset();
    constructEvent.mockReset();
    upsertSub.mockResolvedValue({ id: 'sub_row_1' });
    constructEvent.mockReturnValue(SUB_EVENT);
  });

  it('writes the event once and ignores re-delivery of the same id', async () => {
    // First delivery: insert returns the row (not yet processed).
    processedInsert.mockResolvedValueOnce([{ eventId: SUB_EVENT.id }]);
    const first = await POST(buildRequest('{}'));
    expect(first.status).toBe(200);
    expect(upsertSub).toHaveBeenCalledTimes(1);

    // Second delivery of same event: insert returns empty via onConflictDoNothing.
    processedInsert.mockResolvedValueOnce([]);
    const second = await POST(buildRequest('{}'));
    expect(second.status).toBe(200);
    expect(upsertSub).toHaveBeenCalledTimes(1); // unchanged — no duplicate handler call
  });

  it('rejects missing signature with 400', async () => {
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it('rejects a bad signature with 400 and does not write', async () => {
    constructEvent.mockImplementationOnce(() => {
      throw new Error('bad sig');
    });
    const res = await POST(buildRequest('{}'));
    expect(res.status).toBe(400);
    expect(processedInsert).not.toHaveBeenCalled();
    expect(upsertSub).not.toHaveBeenCalled();
  });
});
