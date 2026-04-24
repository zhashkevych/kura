import { requireAppUser } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireAppUser();

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
    </div>
  );
}
