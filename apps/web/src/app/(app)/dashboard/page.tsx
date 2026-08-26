import type { Metadata } from 'next';
import Link from 'next/link';
import { Camera } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { requireSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Riepilogo' };

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <>
      <PageHeader
        title={`Ciao, ${session.member.display_name}`}
        subtitle={session.household.name}
      />

      <EmptyState
        icon={<Camera />}
        title="Non c'è ancora niente da mostrare"
        description="Carica il primo scontrino: bastano una foto o un file JSON già pronto."
        action={
          <Button asChild size="lg">
            <Link href="/cattura">Aggiungi uno scontrino</Link>
          </Button>
        }
      />
    </>
  );
}
