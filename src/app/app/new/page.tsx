import { asc, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { templates } from '@/db/schema';
import { requireAppUser } from '@/lib/auth-helpers';
import { UrlInputForm } from '@/components/url-input-form';

export const dynamic = 'force-dynamic';

export default async function NewSummaryPage() {
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
      <h1 className="text-2xl font-semibold">New summary</h1>
      <p className="mt-2 text-[var(--muted-foreground)]">
        Paste a YouTube URL. We&apos;ll fetch the transcript and generate a structured note.
      </p>
      <div className="mt-8">
        <UrlInputForm templates={rows} />
      </div>
    </div>
  );
}
