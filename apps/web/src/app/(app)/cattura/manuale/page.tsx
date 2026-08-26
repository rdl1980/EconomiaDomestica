import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCatalogContext } from '@/lib/data/catalog';
import { requireSession } from '@/lib/session';
import { ManualForm } from './form';

export const metadata: Metadata = { title: 'Inserisci a mano' };

export default async function ManualePage() {
  const session = await requireSession();
  const catalog = await getCatalogContext(session.household.id);

  return (
    <>
      <Link
        href="/cattura"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Aggiungi
      </Link>

      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Inserisci a mano</h1>
        <p className="text-sm text-fg-muted">
          Bastano negozio, data e le righe: il resto lo sistemi nella revisione.
        </p>
      </header>

      <ManualForm vendors={catalog.vendors.map((v) => ({ id: v.id, name: v.name }))} />
    </>
  );
}
