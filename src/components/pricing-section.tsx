'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

type Plan = 'monthly' | 'yearly';

const PLAN_STORAGE_KEY = 'kura.pricing.plan';

export function PricingSection() {
  const [plan, setPlan] = useState<Plan>('monthly');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autofiredRef = useRef(false);
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(PLAN_STORAGE_KEY) : null;
    if (saved === 'monthly' || saved === 'yearly') setPlan(saved);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PLAN_STORAGE_KEY, plan);
    }
  }, [plan]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || autofiredRef.current) return;
    const requested = search.get('upgrade') as Plan | null;
    if (requested === 'monthly' || requested === 'yearly') {
      autofiredRef.current = true;
      setPlan(requested);
      void startCheckout(requested);
    }
  }, [isLoaded, isSignedIn, search]);

  async function startCheckout(selected: Plan) {
    setError(null);
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(
        `/sign-up?redirect_url=${encodeURIComponent(`/pricing?upgrade=${selected}`)}`,
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selected }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'Could not start checkout. Try again.');
        setBusy(false);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setError('Could not start checkout. Try again.');
      setBusy(false);
    }
  }

  function startFree() {
    if (!isLoaded) return;
    if (isSignedIn) {
      router.push('/app');
    } else {
      router.push('/sign-up?redirect_url=/app');
    }
  }

  const proPrice = plan === 'monthly' ? '$9.99' : '$84';
  const proSuffix = plan === 'monthly' ? '/month' : '/year';
  const proFootnote =
    plan === 'monthly' ? 'or $84/year — save 30%' : '$7/month, billed yearly';

  return (
    <section id="pricing" className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="text-3xl font-semibold tracking-tight">Pricing</h2>

      <div className="mt-8 flex items-center gap-2 text-sm">
        <BillingToggle plan={plan} onChange={setPlan} />
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card emphasized={false}>
          <CardName>Free</CardName>
          <CardPrice price="$0" />
          <CardTagline>For trying it out.</CardTagline>
          <CardBullets
            bullets={[
              '10 summaries per month',
              'All three templates',
              'Markdown export',
              'Hosted, no setup',
            ]}
          />
          <CardCta>
            <button
              type="button"
              onClick={startFree}
              className="inline-block rounded-md border border-[var(--border)] px-4 py-2 font-medium"
            >
              Try it free →
            </button>
          </CardCta>
        </Card>

        <Card emphasized>
          <CardName>Pro</CardName>
          <CardPrice price={proPrice} suffix={proSuffix} footnote={proFootnote} />
          <CardTagline>For daily use.</CardTagline>
          <CardBullets
            bullets={[
              'Unlimited summaries',
              'Channel subscriptions (coming soon)',
              'Notion sync',
              'Priority support',
            ]}
          />
          <CardCta>
            <button
              type="button"
              onClick={() => startCheckout(plan)}
              disabled={busy}
              className="inline-block rounded-md bg-[var(--primary)] px-4 py-2 font-medium text-[var(--primary-foreground)] disabled:opacity-60"
            >
              {busy ? 'Redirecting…' : 'Start free trial →'}
            </button>
            {error ? (
              <div className="mt-2 text-xs text-red-500">{error}</div>
            ) : null}
          </CardCta>
        </Card>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        Or self-host the open-source core with your own API key — free forever.
      </p>

      <p className="mt-2 text-center text-xs text-[var(--muted-foreground)]">
        Already using Kura?{' '}
        <Link href="/app" className="underline-offset-4 hover:underline">
          Open the app
        </Link>
      </p>
    </section>
  );
}

function BillingToggle({ plan, onChange }: { plan: Plan; onChange: (p: Plan) => void }) {
  return (
    <div className="inline-flex rounded-md border border-[var(--border)] p-0.5 text-xs">
      <ToggleButton active={plan === 'monthly'} onClick={() => onChange('monthly')}>
        Monthly
      </ToggleButton>
      <ToggleButton active={plan === 'yearly'} onClick={() => onChange('yearly')}>
        Yearly · save 30%
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-[5px] px-3 py-1.5 font-medium transition ' +
        (active
          ? 'bg-[var(--foreground)] text-[var(--background)]'
          : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')
      }
    >
      {children}
    </button>
  );
}

function Card({
  emphasized,
  children,
}: {
  emphasized: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        'flex h-full flex-col rounded-lg p-6 ' +
        (emphasized
          ? 'border-2 border-[var(--foreground)]'
          : 'border border-[var(--border)]')
      }
    >
      {children}
    </div>
  );
}

function CardName({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
      {children}
    </div>
  );
}

function CardPrice({
  price,
  suffix,
  footnote,
}: {
  price: string;
  suffix?: string;
  footnote?: string;
}) {
  return (
    <>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight">{price}</span>
        {suffix ? <span className="text-[var(--muted-foreground)]">{suffix}</span> : null}
      </div>
      {footnote ? (
        <div className="mt-1 text-sm text-[var(--muted-foreground)]">{footnote}</div>
      ) : null}
    </>
  );
}

function CardTagline({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-[var(--muted-foreground)]">{children}</p>;
}

function CardBullets({ bullets }: { bullets: string[] }) {
  return (
    <ul className="mt-6 space-y-2 text-sm">
      {bullets.map((b) => (
        <li key={b}>{b}</li>
      ))}
    </ul>
  );
}

function CardCta({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto pt-8">{children}</div>;
}
