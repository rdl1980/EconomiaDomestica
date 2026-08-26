import type { Metadata } from 'next';
import { TrendingDown } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Prezzi' };

export default function PrezziPage() {
  return (
    <>
      <PageHeader title="Prezzi" subtitle="Dove conviene comprare cosa." />
      <EmptyState
        icon={<TrendingDown />}
        title="Serve un po' di storia"
        description="Il confronto fra negozi si accende quando lo stesso prodotto è stato comprato almeno due volte."
      />
    </>
  );
}
