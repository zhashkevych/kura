'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { formatTimestamp } from '@/lib/youtube';
import { SummaryViewer } from './summary-viewer';
import { DownloadButton } from './download-button';
import { ProcessingIndicator } from './processing-indicator';

type SummaryInitial = {
  id: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  errorMessage: string | null;
  createdAt: string;
  video: {
    id: string;
    youtubeId: string;
    title: string;
    channelName: string;
    durationSeconds: number | null;
    thumbnailUrl: string | null;
    publishedAt: string | null;
  };
};

type PollResponse = SummaryInitial & {
  content: unknown;
};

export function SummaryPageClient({
  initial,
  initialMarkdown,
}: {
  initial: SummaryInitial;
  initialMarkdown: string | null;
}) {
  const [state, setState] = useState<SummaryInitial>(initial);
  const [markdown, setMarkdown] = useState<string | null>(initialMarkdown);

  useEffect(() => {
    if (state.status === 'ready' || state.status === 'failed') return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/summaries/${state.id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as PollResponse;
        if (cancelled) return;
        setState({
          id: data.id,
          status: data.status,
          errorMessage: data.errorMessage,
          createdAt: data.createdAt,
          video: data.video,
        });
        if (data.status === 'ready' && !markdown) {
          const mdRes = await fetch(`/api/summaries/${state.id}/markdown`, { cache: 'no-store' });
          if (mdRes.ok) setMarkdown(await mdRes.text());
        }
      } catch {
        /* polling is best-effort */
      }
    };

    const t = setInterval(poll, 2000);
    poll();
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [state.id, state.status, markdown]);

  return (
    <article className="space-y-6">
      <header className="flex gap-4">
        {state.video.thumbnailUrl ? (
          <div className="relative w-40 h-[90px] rounded overflow-hidden shrink-0">
            <Image
              src={state.video.thumbnailUrl}
              alt=""
              fill
              sizes="160px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-40 h-[90px] bg-[var(--muted)] rounded shrink-0" />
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold line-clamp-2">
            {state.video.title || 'Fetching video…'}
          </h1>
          <div className="mt-1 text-sm text-[var(--muted-foreground)]">
            {state.video.channelName || '—'}
            {state.video.durationSeconds
              ? ` · ${formatTimestamp(state.video.durationSeconds)}`
              : ''}
          </div>
          <div className="mt-3 flex gap-2">
            <a
              href={`https://www.youtube.com/watch?v=${state.video.youtubeId}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm rounded border border-[var(--border)] px-2.5 py-1"
            >
              Open on YouTube
            </a>
            {state.status === 'ready' && (
              <DownloadButton summaryId={state.id} />
            )}
          </div>
        </div>
      </header>

      {state.status === 'pending' || state.status === 'processing' ? (
        <ProcessingIndicator status={state.status} />
      ) : state.status === 'failed' ? (
        <FailedBlock message={state.errorMessage} />
      ) : markdown ? (
        <SummaryViewer markdown={markdown} />
      ) : (
        <div className="text-[var(--muted-foreground)] text-sm">Loading…</div>
      )}
    </article>
  );
}

function FailedBlock({ message }: { message: string | null }) {
  return (
    <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/5 p-4">
      <div className="font-medium">We couldn&apos;t generate this summary.</div>
      <div className="mt-1 text-sm text-[var(--muted-foreground)]">
        {message ?? 'Unknown error.'}
      </div>
    </div>
  );
}
