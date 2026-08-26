import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { JsonImportForm } from './form';

export const metadata: Metadata = { title: 'Importa JSON' };

export default function ImportJsonPage() {
  return (
    <>
      <Link
        href="/cattura"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Aggiungi
      </Link>

      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Importa un JSON</h1>
        <p className="text-sm text-fg-muted">
          Se hai già estratto i dati altrove, caricali qui: il percorso da questo punto in poi è
          identico a quello della foto, revisione compresa.
        </p>
      </header>

      <Card className="mb-5 p-4">
        <p className="text-xs leading-relaxed text-fg-muted">
          Serve il formato <span className="font-medium text-fg">ReceiptDraft 1.0</span>. Il prompt
          pronto da usare con qualsiasi strumento esterno è nel repository, in{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">
            docs/schema/prompt-estrazione.md
          </code>
          .
        </p>
        <a
          href="https://github.com/rdl1980/EconomiaDomestica/blob/main/docs/schema/prompt-estrazione.md"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
        >
          Apri il prompt <ExternalLink className="size-3" />
        </a>
      </Card>

      <JsonImportForm />
    </>
  );
}
