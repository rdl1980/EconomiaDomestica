import type { Metadata } from 'next';
import { Camera } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Aggiungi' };

export default function CatturaPage() {
  return (
    <>
      <PageHeader title="Aggiungi" subtitle="Foto, file JSON o inserimento a mano." />
      <EmptyState icon={<Camera />} title="In costruzione" />
    </>
  );
}
