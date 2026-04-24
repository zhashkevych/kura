import { requireAppUser } from '@/lib/auth-helpers';
import { getSummaryUsage } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireAppUser();
  const usage = await getSummaryUsage(user.id);

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
        <div className="mt-3 rounded-md border border-[var(--border)] p-4 space-y-4">
          <UsageRow label="This hour" window={usage.hour} />
          <UsageRow label="Today" window={usage.day} />
          <p className="text-xs text-[var(--muted-foreground)]">
            Each summary (and each retry of a failed one) counts against both
            windows. Limits reset gradually as older requests age out.
          </p>
        </div>
      </section>
    </div>
  );
}

function UsageRow({
  label,
  window,
}: {
  label: string;
  window: { used: number; limit: number; resetsAt: Date | null };
}) {
  const pct = Math.min(100, Math.round((window.used / window.limit) * 100));
  const atLimit = window.used >= window.limit;
  const resetText = window.resetsAt ? formatResetsIn(window.resetsAt) : null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm tabular-nums text-[var(--muted-foreground)]">
          {window.used} / {window.limit}
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--muted)]">
        <div
          className={`h-1.5 rounded-full transition-all ${
            atLimit ? 'bg-[var(--destructive)]' : 'bg-[var(--primary)]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {resetText && (
        <div className="mt-1.5 text-xs text-[var(--muted-foreground)]">
          Next slot frees up {resetText}
        </div>
      )}
    </div>
  );
}

function formatResetsIn(resetsAt: Date): string {
  const deltaMs = resetsAt.getTime() - Date.now();
  if (deltaMs <= 0) return 'now';
  const minutes = Math.ceil(deltaMs / 60_000);
  if (minutes < 60) return `in ~${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  return `in ~${hours}h`;
}
