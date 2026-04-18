'use client';

import { useState } from 'react';

export function ManageBillingButton({ resume = false }: { resume?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium disabled:opacity-50"
    >
      {loading ? 'Opening…' : resume ? 'Resume subscription' : 'Manage billing'}
    </button>
  );
}
