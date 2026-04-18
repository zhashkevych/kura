'use client';

import { useEffect, useState } from 'react';

export function CancelledToast() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-50 mx-auto max-w-md px-4">
      <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm shadow-lg">
        No worries — try again whenever you&apos;re ready.
      </div>
    </div>
  );
}
