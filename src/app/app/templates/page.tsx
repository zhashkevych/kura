import { asc, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { templates } from '@/db/schema';
import { requireAppUser } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const user = await requireAppUser();

  const rows = await db
    .select({
      id: templates.id,
      name: templates.name,
      description: templates.description,
      isSystem: templates.isSystem,
    })
    .from(templates)
    .where(or(isNull(templates.userId), eq(templates.userId, user.id)))
    .orderBy(asc(templates.isSystem), asc(templates.name));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Templates</h1>
      <p className="mt-2 text-[var(--muted-foreground)]">
        Presets that shape how your notes come out. Custom templates are coming in the next release.
      </p>
      <ul className="mt-6 divide-y divide-[var(--border)]">
        {rows.map((t) => (
          <li key={t.id} className="py-4">
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{t.name}</span>
              {t.isSystem && (
                <span className="text-xs rounded border border-[var(--border)] px-1.5 py-0.5 text-[var(--muted-foreground)]">
                  system
                </span>
              )}
            </div>
            {t.description && (
              <p className="text-sm text-[var(--muted-foreground)] mt-1">{t.description}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
