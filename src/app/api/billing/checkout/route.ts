import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { subscriptions, type Subscription } from '@/db/schema';
import { getOrCreateAppUser } from '@/lib/auth-helpers';
import { getOrCreateStripeCustomer } from '@/lib/billing/customer';
import { env } from '@/lib/env';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const postBody = z.object({
  plan: z.enum(['monthly', 'yearly']),
});

const ACTIVE_STATUSES: Subscription['status'][] = ['trialing', 'active', 'past_due'];

export async function POST(req: Request) {
  const user = await getOrCreateAppUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = postBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const existing = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, user.id),
        inArray(subscriptions.status, ACTIVE_STATUSES),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: 'You already have an active subscription. Manage it from settings.' },
      { status: 409 },
    );
  }

  const priceId =
    parsed.data.plan === 'monthly' ? env.STRIPE_PRICE_MONTHLY : env.STRIPE_PRICE_YEARLY;
  const customerId = await getOrCreateStripeCustomer(user);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { userId: user.id },
    },
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    billing_address_collection: 'required',
    success_url: `${env.NEXT_PUBLIC_APP_URL}/app/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pricing?cancelled=1`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: 'Could not create Checkout session.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
