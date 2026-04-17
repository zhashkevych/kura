import { format } from 'date-fns';
import { requireAppUser } from '@/lib/auth-helpers';
import { getQuotaStatus } from '@/lib/quota';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireAppUser();
  const quota = await getQuotaStatus(user.id);

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
          Usage
        </h2>
        <div className="mt-3 rounded-md border border-[var(--border)] p-4">
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-semibold">
              {quota.used} <span className="text-[var(--muted-foreground)] text-lg">/ {quota.limit}</span>
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
        </div>
      </section>
    </div>
  );
}
