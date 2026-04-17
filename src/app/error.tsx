'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong.</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)] max-w-md">
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
