import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { and, desc, eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { summaries, templates, videos } from '@/db/schema';
import { extractYoutubeId } from '@/lib/youtube';
import { getOrCreateAppUser } from '@/lib/auth-helpers';
import { checkSummaryRateLimit, formatRateLimitError } from '@/lib/rate-limit';
import { processSummary } from '@/lib/worker/process-summary';

export const dynamic = 'force-dynamic';

const postBody = z.object({
  url: z.string().min(1),
  templateId: z.string().uuid(),
});

export async function POST(req: Request) {
  const user = await getOrCreateAppUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const limit = await checkSummaryRateLimit(user.id);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: formatRateLimitError(limit),
        retryAfterSeconds: limit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSeconds) },
      },
    );
  }

  const parsed = postBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const youtubeId = extractYoutubeId(parsed.data.url);
  if (!youtubeId) {
    return NextResponse.json({ error: 'Could not parse a YouTube video ID from that URL.' }, { status: 400 });
  }

  const [template] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, parsed.data.templateId))
    .limit(1);

  if (!template) {
    return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
  }
  if (template.userId != null && template.userId !== user.id) {
    return NextResponse.json({ error: 'Template not accessible.' }, { status: 404 });
  }

  // Upsert video stub (real metadata filled in worker).
  const [video] = await db
    .insert(videos)
    .values({
      youtubeId,
      title: '',
      channelName: '',
    })
    .onConflictDoUpdate({
      target: videos.youtubeId,
      set: { youtubeId },
    })
    .returning();

  // Dedupe: return the existing summary if this user already has one for this video.
  const [existing] = await db
    .select()
    .from(summaries)
    .where(and(eq(summaries.userId, user.id), eq(summaries.videoId, video.id)))
    .limit(1);

  if (existing && existing.status !== 'failed') {
    return NextResponse.json(
      { summaryId: existing.id, status: existing.status },
      { status: 409 },
    );
  }

  if (existing) {
    await db
      .update(summaries)
      .set({
        status: 'pending',
        errorMessage: null,
        templateId: template.id,
        updatedAt: new Date(),
      })
      .where(eq(summaries.id, existing.id));

    after(async () => {
      try {
        await processSummary(existing.id);
      } catch (err) {
        console.error('[after processSummary]', err);
      }
    });

    return NextResponse.json({ summaryId: existing.id, status: 'pending' }, { status: 200 });
  }

  let summaryId: string;
  try {
    const [inserted] = await db
      .insert(summaries)
      .values({
        userId: user.id,
        videoId: video.id,
        templateId: template.id,
        status: 'pending',
      })
      .returning({ id: summaries.id });

    summaryId = inserted.id;
  } catch (err) {
    console.error('[POST /api/summaries] insert failed:', err);
    return NextResponse.json({ error: 'Could not create summary.' }, { status: 500 });
  }

  after(async () => {
    try {
      await processSummary(summaryId);
    } catch (err) {
      console.error('[after processSummary]', err);
    }
  });

  return NextResponse.json({ summaryId, status: 'pending' }, { status: 200 });
}

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const user = await getOrCreateAppUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const url = new URL(req.url);
  const parsed = listQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }
  const { limit, cursor } = parsed.data;

  const where = cursor
    ? and(eq(summaries.userId, user.id), lt(summaries.createdAt, new Date(cursor)))
    : eq(summaries.userId, user.id);

  const rows = await db
    .select({
      id: summaries.id,
      status: summaries.status,
      errorMessage: summaries.errorMessage,
      createdAt: summaries.createdAt,
      videoId: videos.id,
      youtubeId: videos.youtubeId,
      title: videos.title,
      channelName: videos.channelName,
      durationSeconds: videos.durationSeconds,
      thumbnailUrl: videos.thumbnailUrl,
      publishedAt: videos.publishedAt,
    })
    .from(summaries)
    .innerJoin(videos, eq(videos.id, summaries.videoId))
    .where(where)
    .orderBy(desc(summaries.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  return NextResponse.json({ items, nextCursor });
}
