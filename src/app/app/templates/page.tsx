import { asc, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { templates } from '@/db/schema';
import { requireAppUser } from '@/lib/auth-helpers';
import { TemplateCard } from '@/components/template-card';
import { renderMarkdown } from '@/lib/templates/render-markdown';
import { getSampleForTemplate } from '@/lib/templates/samples';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const user = await requireAppUser();

  const rows = await db
    .select({
      id: templates.id,
      name: templates.name,
      description: templates.description,
      isSystem: templates.isSystem,
      markdownTemplate: templates.markdownTemplate,
    })
    .from(templates)
    .where(or(isNull(templates.userId), eq(templates.userId, user.id)))
    .orderBy(asc(templates.isSystem), asc(templates.name));

  const cards = rows.map((t) => {
    const sample = getSampleForTemplate(t.name);
    let exampleMarkdown: string | null = null;
    if (sample) {
      try {
        exampleMarkdown = renderMarkdown({
          markdownTemplate: t.markdownTemplate,
          templateKey: `sample:${t.id}`,
          content: sample.content,
          video: {
            youtubeId: sample.video.youtubeId,
            title: sample.video.title,
            channelName: sample.video.channelName,
            durationSeconds: sample.video.durationSeconds,
            publishedAt: sample.video.publishedAt
              ? new Date(sample.video.publishedAt)
              : null,
          },
          summary: { createdAt: new Date(sample.video.publishedAt) },
        });
      } catch {
        exampleMarkdown = null;
      }
    }
    return { ...t, exampleMarkdown };
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Templates</h1>
      <p className="mt-2 text-[var(--muted-foreground)]">
        Presets that shape how your notes come out. Custom templates are coming in the next release.
      </p>
      <ul className="mt-6 divide-y divide-[var(--border)]">
        {cards.map((t) => (
          <TemplateCard
            key={t.id}
            name={t.name}
            description={t.description}
            isSystem={t.isSystem}
            exampleMarkdown={t.exampleMarkdown}
          />
        ))}
      </ul>
    </div>
  );
}
