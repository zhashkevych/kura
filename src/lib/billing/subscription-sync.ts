import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { subscriptions, users, type Subscription } from '@/db/schema';

/**
 * Writes the latest Stripe subscription state into our subscriptions table.
 * Idempotent per (stripe_subscription_id) — called by the webhook handler for
 * created/updated/deleted events. Returns the row that was upserted, or null
 * if we couldn't resolve a local user (logged at call site).
 */
export async function upsertSubscriptionFromStripe(
  sub: Stripe.Subscription,
): Promise<Subscription | null> {
  const userId = await resolveUserId(sub);
  if (!userId) return null;

  const item = sub.items.data[0];
  if (!item) return null;

  const status = sub.status as Subscription['status'];
  const values = {
    userId,
    stripeSubscriptionId: sub.id,
    stripePriceId: item.price.id,
    status,
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    updatedAt: new Date(),
  } as const;

  const [row] = await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: values,
    })
    .returning();

  return row ?? null;
}

async function resolveUserId(sub: Stripe.Subscription): Promise<string | null> {
  const metaUserId = sub.metadata?.userId;
  if (metaUserId) return metaUserId;

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  return rows[0]?.id ?? null;
}
