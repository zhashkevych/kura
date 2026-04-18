import { Webhook } from 'svix';
import { headers } from 'next/headers';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { env } from '@/lib/env';

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
        .values({ clerkId, email })
        .onConflictDoUpdate({
          target: users.clerkId,
          set: { email },
        });
      break;
    }
    case 'user.deleted': {
      if (evt.data.id) {
        await db.delete(users).where(eq(users.clerkId, evt.data.id));
      }
      break;
    }
  }

  return new Response('ok', { status: 200 });
}
