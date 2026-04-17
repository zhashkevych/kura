import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        That page doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm"
      >
        Home
      </Link>
    </main>
  );
}
