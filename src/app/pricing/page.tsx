import { PricingSection } from '@/components/pricing-section';
import { CancelledToast } from './cancelled-toast';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ cancelled?: string }>;
};

export default async function PricingPage({ searchParams }: Props) {
  const { cancelled } = await searchParams;
  return (
    <main>
      {cancelled ? <CancelledToast /> : null}
      <PricingSection />
    </main>
  );
}
