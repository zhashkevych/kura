export function ProcessingIndicator({
  status,
}: {
  status: 'pending' | 'processing';
}) {
  const label = status === 'pending' ? 'Fetching transcript…' : 'Generating summary…';
  return (
    <div className="rounded-lg border border-[var(--border)] p-6 flex items-center gap-3">
      <span className="inline-block h-4 w-4 rounded-full border-2 border-[var(--muted-foreground)] border-t-transparent animate-spin" />
      <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}
