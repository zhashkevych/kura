import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { summaries, templates, videos } from '@/db/schema';
import { requireAppUser } from '@/lib/auth-helpers';
import { SummaryPageClient } from '@/components/summary-page-client';
import { renderMarkdown } from '@/lib/templates/render-markdown';
import { summaryContentSchema } from '@/types/summary-content';

export const dynamic = 'force-dynamic';

export default async function SummaryPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await requireAppUser();

  const [row] = await db
    .select({
      summary: summaries,
      video: videos,
      template: templates,
    })
    .from(summaries)
    .innerJoin(videos, eq(videos.id, summaries.videoId))
    .leftJoin(templates, eq(templates.id, summaries.templateId))
    .where(and(eq(summaries.id, id), eq(summaries.userId, user.id)))
    .limit(1);

  if (!row) notFound();

  let markdown: string | null = null;
  if (row.summary.status === 'ready' && row.template) {
    const parsed = summaryContentSchema.safeParse(row.summary.content);
    if (parsed.success) {
      markdown = renderMarkdown({
        markdownTemplate: row.template.markdownTemplate,
        templateKey: row.template.id,
        content: parsed.data,
        video: row.video,
        summary: { createdAt: row.summary.createdAt },
      });
    }
  }

  return (
    <SummaryPageClient
      initial={{
        id: row.summary.id,
        status: row.summary.status,
        errorMessage: row.summary.errorMessage,
        createdAt: row.summary.createdAt.toISOString(),
        video: {
          id: row.video.id,
          youtubeId: row.video.youtubeId,
          title: row.video.title,
          channelName: row.video.channelName,
          durationSeconds: row.video.durationSeconds,
          thumbnailUrl: row.video.thumbnailUrl,
          publishedAt: row.video.publishedAt?.toISOString() ?? null,
        },
      }}
      initialMarkdown={markdown}
    />
  );
}
