import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { summaries, templates, videos } from '@/db/schema';
import { getOrCreateAppUser } from '@/lib/auth-helpers';
import { renderMarkdown } from '@/lib/templates/render-markdown';
import { summaryContentSchema } from '@/types/summary-content';
import { slugify } from '@/lib/youtube';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateAppUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await ctx.params;

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

  if (!row) return new NextResponse('Not found', { status: 404 });
  if (row.summary.status !== 'ready') {
    return new NextResponse('Summary is not ready yet', { status: 409 });
  }
  if (!row.template) return new NextResponse('Template missing', { status: 500 });

  const parsed = summaryContentSchema.safeParse(row.summary.content);
  if (!parsed.success) {
    return new NextResponse('Summary content is malformed', { status: 500 });
  }

  const markdown = renderMarkdown({
    markdownTemplate: row.template.markdownTemplate,
    templateKey: row.template.id,
    content: parsed.data,
    video: row.video,
    summary: { createdAt: row.summary.createdAt },
  });

  const slug = slugify(row.video.title || 'summary');

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.md"`,
    },
  });
}
