'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Status =
  | { plan: 'free'; subscription: null }
  | {
      plan: 'pro';
      subscription: {
        id: string;
        status: string;
        cancelAtPeriodEnd: boolean;
        trialEndsAt: string | null;
      };
    };

const POLL_INTERVAL_MS = 1000;
const MAX_WAIT_MS = 8000;

export default function BillingSuccessPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const res = await fetch('/api/billing/status', { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as Status;
          if (cancelled) return;
          setStatus(data);
          if (data.plan === 'pro') return;
        }
      } catch {
        // swallow — we'll retry
      }
      if (Date.now() - start >= MAX_WAIT_MS) {
        setTimedOut(true);
        return;
      }
      setTimeout(() => void tick(), POLL_INTERVAL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
    };
  }, []);

  const isPro = status?.plan === 'pro';

  return (
    <div className="mx-auto max-w-xl py-16">
      {isPro ? (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome to Pro.</h1>
          <p className="mt-4 text-[var(--muted-foreground)]">
            Your 7-day trial is active. Create as many summaries as you like —
            we&apos;ll email you before the trial ends.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/app"
              className="rounded-md bg-[var(--primary)] px-4 py-2 font-medium text-[var(--primary-foreground)]"
            >
              Go to library
            </Link>
            <Link
              href="/app/settings"
              className="rounded-md border border-[var(--border)] px-4 py-2 font-medium"
            >
              Manage billing
            </Link>
          </div>
        </>
      ) : timedOut ? (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Almost there.</h1>
          <p className="mt-4 text-[var(--muted-foreground)]">
            Your payment went through — we&apos;re still finalising the subscription.
            Head to your library, and Pro will activate in the next minute.
            We&apos;ll email you if anything goes wrong.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/app"
              className="rounded-md bg-[var(--primary)] px-4 py-2 font-medium text-[var(--primary-foreground)]"
            >
              Go to library
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Setting up your subscription…</h1>
          <p className="mt-4 text-[var(--muted-foreground)]">
            Hang tight for a moment — confirming with Stripe.
          </p>
        </>
      )}
    </div>
  );
}
