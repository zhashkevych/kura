'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { formatTimestamp } from '@/lib/youtube';

export type LibraryRowData = {
  id: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  createdAt: string;
  youtubeId: string;
  title: string | null;
  channelName: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
};

function rowTitle(r: LibraryRowData): string {
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

export function LibraryRow({ row }: { row: LibraryRowData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const youtubeUrl = row.youtubeId
    ? `https://www.youtube.com/watch?v=${row.youtubeId}`
    : null;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/summaries/${row.id}`, { method: 'DELETE' });
      if (res.ok || res.status === 404) {
        setConfirmDelete(false);
        setOpen(false);
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li className="group relative">
      <Link
        href={`/app/summaries/${row.id}`}
        className="flex gap-4 p-3 -mx-3 rounded-md transition-colors hover:bg-[var(--muted)]/50"
      >
        {row.thumbnailUrl ? (
          <div className="shrink-0 relative w-40 h-[90px] overflow-hidden rounded">
            <Image
              src={row.thumbnailUrl}
              alt=""
              fill
              sizes="160px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="shrink-0 w-40 h-[90px] bg-[var(--muted)] rounded" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium line-clamp-2 break-all">{rowTitle(row)}</div>
          <div className="text-sm text-[var(--muted-foreground)] mt-1">
            {row.channelName || '—'}
            {row.durationSeconds ? ` · ${formatTimestamp(row.durationSeconds)}` : ''}
            {' · '}
            {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
            {row.status !== 'ready' && (
              <span
                className={`ml-2 rounded px-1.5 py-0.5 text-xs uppercase tracking-wide ${
                  row.status === 'failed'
                    ? 'bg-[var(--destructive)] text-white'
                    : 'bg-[var(--muted)]'
                }`}
              >
                {row.status}
              </span>
            )}
          </div>
        </div>
      </Link>

      <div
        ref={menuRef}
        className={`absolute right-3 top-3 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
        }`}
      >
        <button
          type="button"
          aria-label="Row actions"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(e) => {
            stop(e);
            setOpen((v) => !v);
          }}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm leading-none text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          ⋯
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 mt-1 w-44 rounded-md border border-[var(--border)] bg-[var(--background)] shadow-md text-sm overflow-hidden z-10"
            onClick={stop}
          >
            {row.status === 'ready' ? (
              <a
                href={`/api/summaries/${row.id}/markdown`}
                role="menuitem"
                className="block px-3 py-2 hover:bg-[var(--muted)]/60"
                onClick={() => setOpen(false)}
              >
                Download .md
              </a>
            ) : (
              <span className="block px-3 py-2 text-[var(--muted-foreground)] cursor-not-allowed">
                Download .md
              </span>
            )}
            {youtubeUrl && (
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noreferrer"
                role="menuitem"
                className="block px-3 py-2 hover:bg-[var(--muted)]/60"
                onClick={() => setOpen(false)}
              >
                Open on YouTube
              </a>
            )}
            <button
              type="button"
              role="menuitem"
              className="block w-full text-left px-3 py-2 text-[var(--destructive)] hover:bg-[var(--muted)]/60"
              onClick={(e) => {
                stop(e);
                setConfirmDelete(true);
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--background)] p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-medium">Delete this summary?</div>
            <div className="mt-1 text-sm text-[var(--muted-foreground)]">
              This can&apos;t be undone.
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="text-sm rounded border border-[var(--border)] px-3 py-1.5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="text-sm rounded bg-[var(--destructive)] text-white px-3 py-1.5 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
