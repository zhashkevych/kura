import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { CommandK } from '@/components/command-k';
import { AppNav } from '@/components/app-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-5xl flex items-center justify-between p-4">
          <div className="flex items-center gap-6">
            <Link
              href="/app"
              className="text-lg font-semibold tracking-tight rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              kura
            </Link>
            <AppNav />
          </div>
          <div className="flex items-center gap-3">
            <kbd className="hidden sm:inline-block text-xs border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--muted-foreground)]">
              ⌘K
            </kbd>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  userButtonAvatarBox: 'h-8 w-8',
                },
              }}
            />
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-8">{children}</main>
      <CommandK />
    </div>
  );
}
