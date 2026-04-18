'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/app', label: 'Library' },
  { href: '/app/new', label: 'New' },
  { href: '/app/templates', label: 'Templates' },
  { href: '/app/settings', label: 'Settings' },
] as const;

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-4 text-sm">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? 'text-[var(--foreground)] font-medium underline decoration-2 underline-offset-4 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]'
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
