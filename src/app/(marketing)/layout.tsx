import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-5xl flex items-center justify-between p-4">
          <Link
            href="/"
            aria-label="Kura home"
            className="flex items-center gap-2"
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] text-sm leading-none"
              style={{
                fontFamily:
                  '"Hiragino Sans", "Yu Gothic", "Noto Sans CJK JP", "Microsoft YaHei", sans-serif',
              }}
            >
              蔵
            </span>
            <span className="text-lg font-semibold tracking-tight">kura</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <SignedOut>
              <Link href="/sign-in" className="hover:underline">Sign in</Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5"
              >
                Get started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/app"
                className="rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5"
              >
                Open app
              </Link>
            </SignedIn>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
        <div className="mx-auto max-w-5xl p-4">Kura — YouTube → structured Markdown notes.</div>
      </footer>
    </div>
  );
}
