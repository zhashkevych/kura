'use client';

import { useEffect, useRef, useState } from 'react';

export function CopyMarkdownButton({
  summaryId,
  markdown,
}: {
  summaryId: string;
  markdown: string | null;
}) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const onClick = async () => {
    if (status === 'copying') return;
    setStatus('copying');
    try {
      let body = markdown;
      if (!body) {
        const res = await fetch(`/api/summaries/${summaryId}/markdown`, { cache: 'no-store' });
        if (!res.ok) throw new Error('fetch failed');
        body = await res.text();
      }
      await navigator.clipboard.writeText(body);
      setStatus('copied');
    } catch {
      setStatus('error');
    } finally {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setStatus('idle'), 2000);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={status === 'copying'}
        className="text-sm rounded bg-[var(--primary)] text-[var(--primary-foreground)] px-2.5 py-1 disabled:opacity-60"
      >
        {status === 'copying' ? 'Copying…' : 'Copy markdown'}
      </button>
      {status === 'copied' && (
        <span className="text-xs text-[var(--muted-foreground)]" role="status">
          Copied to clipboard.
        </span>
      )}
      {status === 'error' && (
        <span className="text-xs text-[var(--destructive)]" role="status">
          Copy failed.
        </span>
      )}
    </div>
  );
}
