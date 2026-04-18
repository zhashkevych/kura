import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { summaries, videos } from '@/db/schema';
import { requireAppUser } from '@/lib/auth-helpers';
import { formatTimestamp } from '@/lib/youtube';

export const dynamic = 'force-dynamic';

type LibraryRow = {
  title: string | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  youtubeId: string;
};

function rowTitle(r: LibraryRow): string {
  if (r.title) return r.title;
  if (r.status === 'failed') {
    if (r.youtubeId) {
      const url = `https://www.youtube.com/watch?v=${r.youtubeId}`;
      return url.length > 50 ? `${url.slice(0, 49)}…` : url;
    }
    return 'Untitled summary';
  }
  return 'Fetching…';
}

export default async function LibraryPage() {
  const user = await requireAppUser();

  const rows = await db
    .select({
      id: summaries.id,
      status: summaries.status,
      createdAt: summaries.createdAt,
      videoId: videos.id,
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
        <h1 className="text-2xl font-semibold">Your library is empty.</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Paste a YouTube URL to capture your first note.
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
        {rows.map((r) => (
          <li key={r.id} className="py-4">
            <Link href={`/app/summaries/${r.id}`} className="flex gap-4 group">
              {r.thumbnailUrl ? (
                <div className="shrink-0 relative w-32 h-[72px] overflow-hidden rounded">
                  <Image
                    src={r.thumbnailUrl}
                    alt=""
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="shrink-0 w-32 h-[72px] bg-[var(--muted)] rounded" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium group-hover:underline line-clamp-2 break-all">
                  {rowTitle(r)}
                </div>
                <div className="text-sm text-[var(--muted-foreground)] mt-1">
                  {r.channelName || '—'}
                  {r.durationSeconds ? ` · ${formatTimestamp(r.durationSeconds)}` : ''}
                  {' · '}
                  {formatDistanceToNow(r.createdAt, { addSuffix: true })}
                  {r.status !== 'ready' && (
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-xs uppercase tracking-wide ${
                        r.status === 'failed'
                          ? 'bg-[var(--destructive)] text-white'
                          : 'bg-[var(--muted)]'
                      }`}
                    >
                      {r.status}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
