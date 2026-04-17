import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { summaries, videos } from '@/db/schema';
import { getOrCreateAppUser } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateAppUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await ctx.params;

  const [row] = await db
    .select({
      summary: summaries,
      video: videos,
    })
    .from(summaries)
    .innerJoin(videos, eq(videos.id, summaries.videoId))
    .where(and(eq(summaries.id, id), eq(summaries.userId, user.id)))
    .limit(1);

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: row.summary.id,
    status: row.summary.status,
    errorMessage: row.summary.errorMessage,
    content: row.summary.content,
    createdAt: row.summary.createdAt,
    video: {
      id: row.video.id,
      youtubeId: row.video.youtubeId,
      title: row.video.title,
      channelName: row.video.channelName,
      durationSeconds: row.video.durationSeconds,
      thumbnailUrl: row.video.thumbnailUrl,
      publishedAt: row.video.publishedAt,
    },
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateAppUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await ctx.params;

  const result = await db
    .delete(summaries)
    .where(and(eq(summaries.id, id), eq(summaries.userId, user.id)))
    .returning({ id: summaries.id });

  if (result.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
