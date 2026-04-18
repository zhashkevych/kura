import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { subscriptions, type Subscription } from '@/db/schema';
import { getOrCreateAppUser } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

const PRO_STATUSES: Subscription['status'][] = ['trialing', 'active', 'past_due'];

export async function GET() {
  const user = await getOrCreateAppUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [row] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, user.id),
        inArray(subscriptions.status, PRO_STATUSES),
      ),
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!row) {
    return NextResponse.json({ plan: 'free', subscription: null });
  }

  return NextResponse.json({
    plan: 'pro',
    subscription: {
      id: row.id,
      status: row.status,
      stripePriceId: row.stripePriceId,
      currentPeriodStart: row.currentPeriodStart.toISOString(),
      currentPeriodEnd: row.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    },
  });
}
