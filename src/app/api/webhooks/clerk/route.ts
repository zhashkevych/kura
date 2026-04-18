import { Webhook } from 'svix';
import { headers } from 'next/headers';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { subscriptions, users, type Subscription } from '@/db/schema';
import { env } from '@/lib/env';
import { nextMonthlyReset } from '@/lib/quota';
import { stripe } from '@/lib/stripe';

const CANCELLABLE_STATUSES: Subscription['status'][] = [
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'paused',
  'incomplete',
];

export async function POST(req: Request) {
  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  if (!env.CLERK_WEBHOOK_SECRET) {
    return new Response('Webhook not configured', { status: 503 });
  }

  const body = await req.text();
  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);

  let evt: WebhookEvent;
  try {
    evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  switch (evt.type) {
    case 'user.created':
    case 'user.updated': {
      const clerkId = evt.data.id;
      const email =
        evt.data.email_addresses.find((e) => e.id === evt.data.primary_email_address_id)
          ?.email_address ?? evt.data.email_addresses[0]?.email_address;

      if (!clerkId || !email) {
        return new Response('Missing user fields', { status: 400 });
      }

      await db
        .insert(users)
        .values({ clerkId, email, monthlyUsageResetAt: nextMonthlyReset(new Date()) })
        .onConflictDoUpdate({
          target: users.clerkId,
          set: { email },
        });
      break;
    }
    case 'user.deleted': {
      if (!evt.data.id) break;

      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, evt.data.id))
        .limit(1);

      if (row) {
        // Capture any still-billable subs before the cascade wipes them, then
        // cancel in Stripe so the user isn't charged after their account is gone.
        const activeSubs = await db
          .select({ stripeSubscriptionId: subscriptions.stripeSubscriptionId })
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.userId, row.id),
              inArray(subscriptions.status, CANCELLABLE_STATUSES),
            ),
          );
        await Promise.all(
          activeSubs.map((sub) =>
            stripe.subscriptions.cancel(sub.stripeSubscriptionId).catch((err) => {
              console.error(
                `[clerk webhook] failed to cancel stripe sub ${sub.stripeSubscriptionId}:`,
                err,
              );
            }),
          ),
        );
      }

      await db.delete(users).where(eq(users.clerkId, evt.data.id));
      break;
    }
  }

  return new Response('ok', { status: 200 });
}
