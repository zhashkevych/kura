import { NextResponse } from 'next/server';
import { getOrCreateAppUser } from '@/lib/auth-helpers';
import { env } from '@/lib/env';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getOrCreateAppUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing profile found.' }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/app/settings`,
  });

  return NextResponse.json({ url: session.url });
}
