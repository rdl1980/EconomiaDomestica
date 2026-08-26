import type { Metadata } from 'next';
import Link from 'next/link';
import { Braces, Camera, ChevronRight, PencilLine } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/primitives';
import { Card } from '@/components/ui/card';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { PendingDocuments } from './pending-documents';

export const metadata: Metadata = { title: 'Aggiungi' };

const OPTIONS = [
  {
    href: '/cattura/foto',
    icon: Camera,
    title: 'Fotografa lo scontrino',
    description: 'Lo leggiamo noi e ti chiediamo conferma.',
    tone: 'primary' as const,
  },
  {
    href: '/cattura/json',
    icon: Braces,
    title: 'Importa un JSON',
    description: 'Hai già i dati pronti? Caricali, non consuma nulla.',
    tone: 'neutral' as const,
  },
  {
    href: '/cattura/manuale',
    icon: PencilLine,
    title: 'Inserisci a mano',
    description: 'Scontrino illeggibile, o solo due righe da segnare.',
    tone: 'neutral' as const,
  },
] as const;

export default async function CatturaPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from('document')
    .select('id, source, status, draft, created_at')
    .eq('household_id', session.household.id)
    .in('status', ['pending', 'parsing', 'parsed', 'failed'])
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <>
      <PageHeader title="Aggiungi" subtitle="Tre strade, stesso risultato." />

      <div className="space-y-3">
        {OPTIONS.map(({ href, icon: Icon, title, description, tone }) => (
          <Link key={href} href={href} className="block">
            <Card className="flex items-center gap-4 p-4 transition-all active:scale-[0.99] hover:border-border-strong">
              <div
                className={
                  tone === 'primary'
                    ? 'flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg'
                    : 'flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg-muted'
                }
              >
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{title}</p>
                <p className="text-xs text-fg-muted">{description}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
            </Card>
          </Link>
        ))}
      </div>

      {pending && pending.length > 0 ? (
        <section className="mt-8 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-fg">In attesa di conferma</h2>
            <Badge tone="warning">{pending.length}</Badge>
          </div>
          <p className="text-xs text-fg-muted">
            Finché non confermi, questi scontrini non entrano nelle statistiche.
          </p>
          <PendingDocuments documents={pending} />
        </section>
      ) : null}
    </>
  );
}
