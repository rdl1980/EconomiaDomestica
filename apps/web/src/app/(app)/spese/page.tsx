import type { Metadata } from 'next';
import { ReceiptText } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Spese' };

export default function SpesePage() {
  return (
    <>
      <PageHeader title="Spese" subtitle="Tutto quello che è uscito di casa." />
      <EmptyState
        icon={<ReceiptText />}
        title="Ancora nessuna spesa"
        description="Appena carichi il primo scontrino lo trovi qui, con tutte le sue righe."
      />
    </>
  );
}
