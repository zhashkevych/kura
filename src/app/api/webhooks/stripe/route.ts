import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { processedStripeEvents, subscriptions, users } from '@/db/schema';
import { env } from '@/lib/env';
import { stripe } from '@/lib/stripe';
import { upsertSubscriptionFromStripe } from '@/lib/billing/subscription-sync';

// Edge runtime can corrupt raw request bodies — force node runtime so
// stripe.webhooks.constructEvent sees the exact bytes Stripe signed.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const [inserted] = await db
    .insert(processedStripeEvents)
    .values({ eventId: event.id, type: event.type })
    .onConflictDoNothing()
    .returning({ eventId: processedStripeEvents.eventId });

  if (!inserted) {
    console.log(`[stripe webhook] already processed ${event.type} ${event.id}`);
    return NextResponse.json({ received: true });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error(`[stripe webhook] handler failed for ${event.type} ${event.id}:`, err);
    // Business-logic errors shouldn't trigger Stripe retries — keep 200.
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
      if (userId && customerId) {
        await db
          .update(users)
          .set({ stripeCustomerId: customerId })
          .where(eq(users.id, userId));
      }
      // Subscription state arrives via customer.subscription.created; no eager fetch needed.
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const result = await upsertSubscriptionFromStripe(sub);
      if (!result) {
        // customer.subscription.deleted for a cancel we initiated from Clerk
        // webhook is expected if the row was already removed via cascade.
        if (event.type === 'customer.subscription.deleted') {
          await db
            .update(subscriptions)
            .set({ status: 'canceled', updatedAt: new Date() })
            .where(eq(subscriptions.stripeSubscriptionId, sub.id));
        } else {
          console.warn(`[stripe webhook] could not resolve user for sub ${sub.id}`);
        }
      }
      return;
    }
    case 'invoice.payment_failed':
    case 'invoice.payment_succeeded': {
      // Logged; subscription status transitions come through the subscription events.
      console.log(`[stripe webhook] ${event.type}`);
      return;
    }
    default:
      console.log(`[stripe webhook] unhandled event type: ${event.type}`);
  }
}
