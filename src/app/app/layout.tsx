import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { CommandK } from '@/components/command-k';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-5xl flex items-center justify-between p-4">
          <div className="flex items-center gap-6">
            <Link href="/app" className="text-lg font-semibold tracking-tight">
              kura
            </Link>
            <nav className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
              <Link href="/app" className="hover:text-[var(--foreground)]">Library</Link>
              <Link href="/app/new" className="hover:text-[var(--foreground)]">New</Link>
              <Link href="/app/templates" className="hover:text-[var(--foreground)]">Templates</Link>
              <Link href="/app/settings" className="hover:text-[var(--foreground)]">Settings</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <kbd className="hidden sm:inline-block text-xs border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--muted-foreground)]">
              ⌘K
            </kbd>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-8">{children}</main>
      <CommandK />
    </div>
  );
}
