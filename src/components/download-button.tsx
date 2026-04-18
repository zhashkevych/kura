'use client';

export function DownloadButton({ summaryId }: { summaryId: string }) {
  return (
    <a
      href={`/api/summaries/${summaryId}/markdown`}
      className="text-sm rounded border border-[var(--border)] px-2.5 py-1 hover:bg-[var(--muted)]/50"
    >
      Download .md
    </a>
  );
}
