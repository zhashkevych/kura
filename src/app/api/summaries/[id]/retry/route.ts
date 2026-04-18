import { NextResponse, after } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { summaries } from '@/db/schema';
import { getOrCreateAppUser } from '@/lib/auth-helpers';
import { processSummary } from '@/lib/worker/process-summary';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateAppUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await ctx.params;

  const [existing] = await db
    .select({ id: summaries.id, status: summaries.status })
    .from(summaries)
    .where(and(eq(summaries.id, id), eq(summaries.userId, user.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.status !== 'failed') {
    return NextResponse.json(
      { error: 'Summary is not in a failed state' },
      { status: 409 },
    );
  }

  // Note: intentionally skip checkAndIncrementQuota — the original submission
  // already consumed quota and was refunded on failure; retrying should not
  // re-bill the user (per UI-1 spec).
  await db
    .update(summaries)
    .set({ status: 'pending', errorMessage: null, updatedAt: new Date() })
    .where(eq(summaries.id, id));

  after(async () => {
    try {
      await processSummary(id);
    } catch (err) {
      console.error('[after processSummary retry]', err);
    }
  });

  return NextResponse.json({ id, status: 'pending' }, { status: 202 });
}
