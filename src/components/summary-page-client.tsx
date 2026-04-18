'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatTimestamp } from '@/lib/youtube';
import { SummaryViewer } from './summary-viewer';
import { DownloadButton } from './download-button';
import { CopyMarkdownButton } from './copy-markdown-button';
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
  const router = useRouter();
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

  const youtubeUrl = state.video.youtubeId
    ? `https://www.youtube.com/watch?v=${state.video.youtubeId}`
    : null;

  const isFailed = state.status === 'failed';
  const displayTitle =
    state.video.title ||
    (isFailed && youtubeUrl ? youtubeUrl : 'Fetching video…');

  const handleRetry = async () => {
    const res = await fetch(`/api/summaries/${state.id}/retry`, { method: 'POST' });
    if (res.ok) {
      setState((s) => ({ ...s, status: 'pending', errorMessage: null }));
    }
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/summaries/${state.id}`, { method: 'DELETE' });
    if (res.ok || res.status === 404) {
      router.push('/app');
    }
  };

  return (
    <article className="space-y-6">
      <Link
        href="/app"
        className="inline-block text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
      >
        ← Library
      </Link>
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
          <h1 className="text-xl font-semibold line-clamp-2 break-all">
            {displayTitle}
          </h1>
          <div className="mt-1 text-sm text-[var(--muted-foreground)]">
            {state.video.channelName || '—'}
            {state.video.durationSeconds
              ? ` · ${formatTimestamp(state.video.durationSeconds)}`
              : ''}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {state.status === 'ready' && (
              <>
                <CopyMarkdownButton summaryId={state.id} markdown={markdown} />
                <DownloadButton summaryId={state.id} />
              </>
            )}
            {youtubeUrl && (
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm rounded px-2.5 py-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/50"
              >
                Open on YouTube
              </a>
            )}
          </div>
        </div>
      </header>

      {state.status === 'pending' || state.status === 'processing' ? (
        <ProcessingIndicator status={state.status} />
      ) : isFailed ? (
        <FailedBlock
          message={state.errorMessage}
          onRetry={handleRetry}
          onDelete={handleDelete}
        />
      ) : markdown ? (
        <SummaryViewer markdown={markdown} />
      ) : (
        <div className="text-[var(--muted-foreground)] text-sm">Loading…</div>
      )}
    </article>
  );
}

function FailedBlock({
  message,
  onRetry,
  onDelete,
}: {
  message: string | null;
  onRetry: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<'idle' | 'retry' | 'delete'>('idle');

  const run = (kind: 'retry' | 'delete', action: () => Promise<void>) => async () => {
    if (busy !== 'idle') return;
    setBusy(kind);
    try {
      await action();
    } finally {
      setBusy('idle');
    }
  };

  return (
    <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/5 p-4">
      <div className="font-medium">We couldn&apos;t generate this summary.</div>
      <div className="mt-1 text-sm text-[var(--muted-foreground)]">
        {message ?? 'Unknown error.'}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={run('retry', onRetry)}
          disabled={busy !== 'idle'}
          className="text-sm rounded bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 disabled:opacity-50"
        >
          {busy === 'retry' ? 'Retrying…' : 'Retry'}
        </button>
        <button
          type="button"
          onClick={run('delete', onDelete)}
          disabled={busy !== 'idle'}
          className="text-sm rounded border border-[var(--border)] px-3 py-1.5 disabled:opacity-50"
        >
          {busy === 'delete' ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
