import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, type User } from '@/db/schema';
import { stripe } from '@/lib/stripe';

/**
 * Returns the Stripe Customer id for this user, creating it on first call.
 * Safe against double-click races: re-reads the row before creating, and the
 * unique index on users.stripe_customer_id is the DB-level backstop.
 */
export async function getOrCreateStripeCustomer(user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const [fresh] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (fresh?.stripeCustomerId) return fresh.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });

  await db
    .update(users)
    .set({ stripeCustomerId: customer.id })
    .where(eq(users.id, user.id));

  return customer.id;
}
