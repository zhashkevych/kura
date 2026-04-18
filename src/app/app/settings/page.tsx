import { format } from 'date-fns';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { subscriptions, type Subscription } from '@/db/schema';
import { requireAppUser } from '@/lib/auth-helpers';
import { env } from '@/lib/env';
import { getQuotaStatus } from '@/lib/quota';
import { ManageBillingButton } from './manage-billing-button';

export const dynamic = 'force-dynamic';

const PRO_STATUSES: Subscription['status'][] = ['trialing', 'active', 'past_due'];

export default async function SettingsPage() {
  const user = await requireAppUser();
  const quota = await getQuotaStatus(user.id);

  const [sub] = await db
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Account
        </h2>
        <div className="mt-3 rounded-md border border-[var(--border)] p-4">
          <div className="text-sm">{user.email}</div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Plan
        </h2>
        <div className="mt-3 rounded-md border border-[var(--border)] p-4">
          {sub ? <ProPlanRow subscription={sub} /> : <FreePlanRow />}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Usage
        </h2>
        <div className="mt-3 rounded-md border border-[var(--border)] p-4">
          {quota.unlimited ? (
            <div className="text-sm">Unlimited summaries on Pro.</div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-semibold">
                  {quota.used}{' '}
                  <span className="text-[var(--muted-foreground)] text-lg">/ {quota.limit}</span>
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">this month</div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full bg-[var(--primary)]"
                  style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }}
                />
              </div>
              <div className="mt-3 text-xs text-[var(--muted-foreground)]">
                Resets {format(quota.resetAt, 'PPP')}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function FreePlanRow() {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">Free</div>
        <div className="text-xs text-[var(--muted-foreground)]">
          10 summaries per month.
        </div>
      </div>
      <a
        href="/pricing"
        className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
      >
        Upgrade to Pro
      </a>
    </div>
  );
}

function ProPlanRow({ subscription }: { subscription: Subscription }) {
  const interval =
    subscription.stripePriceId === env.STRIPE_PRICE_YEARLY ? 'yearly' : 'monthly';
  const label =
    subscription.status === 'trialing' && subscription.trialEndsAt
      ? `Pro (trial ends ${format(subscription.trialEndsAt, 'PPP')})`
      : subscription.cancelAtPeriodEnd
        ? `Pro (cancels ${format(subscription.currentPeriodEnd, 'PPP')})`
        : `Pro (${interval})`;

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {subscription.status === 'past_due' ? (
          <div className="text-xs text-[var(--muted-foreground)]">
            Payment failed — update your card in the billing portal to keep Pro.
          </div>
        ) : null}
      </div>
      <ManageBillingButton resume={subscription.cancelAtPeriodEnd} />
    </div>
  );
}
