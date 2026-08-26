import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { isVisionConfigured } from '@/lib/vision';
import { PhotoForm } from './form';

export const metadata: Metadata = { title: 'Fotografa lo scontrino' };

export default function FotoPage() {
  const configured = isVisionConfigured();

  return (
    <>
      <Link
        href="/cattura"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Aggiungi
      </Link>

      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Fotografa lo scontrino</h1>
        <p className="text-sm text-fg-muted">
          Inquadra tutto lo scontrino, dritto e ben illuminato. Poi controlli e confermi tu.
        </p>
      </header>

      {!configured ? (
        <div className="mb-5 flex gap-3 rounded-[var(--radius-card)] border border-warning-soft bg-warning-soft p-4">
          <Info className="size-5 shrink-0 text-warning" />
          <div className="space-y-1 text-xs leading-relaxed">
            <p className="font-medium text-fg">Lettura automatica non attiva</p>
            <p className="text-fg-muted">
              Manca la chiave API per l’estrazione. La foto viene comunque salvata, ma i dati vanno
              inseriti a mano o importati come JSON.
            </p>
          </div>
        </div>
      ) : null}

      <PhotoForm enabled={configured} />
    </>
  );
}
