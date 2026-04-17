'use client';

export function DownloadButton({ summaryId }: { summaryId: string }) {
  return (
    <a
      href={`/api/summaries/${summaryId}/markdown`}
      className="text-sm rounded bg-[var(--primary)] text-[var(--primary-foreground)] px-2.5 py-1"
    >
      Download .md
    </a>
  );
}
