import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { summaries, videos } from '@/db/schema';
import { requireAppUser } from '@/lib/auth-helpers';
import { LibraryRow, type LibraryRowData } from '@/components/library-row';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const user = await requireAppUser();

  const rows = await db
    .select({
      id: summaries.id,
      status: summaries.status,
      createdAt: summaries.createdAt,
      youtubeId: videos.youtubeId,
      title: videos.title,
      channelName: videos.channelName,
      durationSeconds: videos.durationSeconds,
      thumbnailUrl: videos.thumbnailUrl,
    })
    .from(summaries)
    .innerJoin(videos, eq(videos.id, summaries.videoId))
    .where(eq(summaries.userId, user.id))
    .orderBy(desc(summaries.createdAt))
    .limit(50);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div aria-hidden className="text-5xl mb-4">📚</div>
        <h1 className="text-2xl font-semibold">Your library is empty</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Paste your first YouTube URL to build your second brain.
        </p>
        <Link
          href="/app/new"
          className="mt-6 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm"
        >
          New summary
        </Link>
      </div>
    );
  }

  const items: LibraryRowData[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    youtubeId: r.youtubeId,
    title: r.title,
    channelName: r.channelName,
    durationSeconds: r.durationSeconds,
    thumbnailUrl: r.thumbnailUrl,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Library</h1>
        <Link
          href="/app/new"
          className="rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 text-sm"
        >
          New summary
        </Link>
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {items.map((r) => (
          <LibraryRow key={r.id} row={r} />
        ))}
      </ul>
    </div>
  );
}
