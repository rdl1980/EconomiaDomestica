import type { Metadata } from 'next';
import Link from 'next/link';
import { ReceiptText, Store } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { euro, relativeDay } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { numericToCents } from '@ed/db';

export const metadata: Metadata = { title: 'Spese' };

export default async function SpesePage() {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: transactions } = await supabase
    .from('transaction')
    .select('id, occurred_at, total_amount, module, vendor:vendor_id(name), line_item(count)')
    .eq('household_id', session.household.id)
    .order('occurred_at', { ascending: false })
    .limit(100);

  if (!transactions || transactions.length === 0) {
    return (
      <>
        <PageHeader title="Spese" subtitle="Tutto quello che è uscito di casa." />
        <EmptyState
          icon={<ReceiptText />}
          title="Ancora nessuna spesa"
          description="Appena confermi il primo scontrino lo trovi qui, con tutte le sue righe."
          action={
            <Button asChild>
              <Link href="/cattura">Aggiungi uno scontrino</Link>
            </Button>
          }
        />
      </>
    );
  }

  // Raggruppa per mese: scorrere sessanta spese piatte non dice niente,
  // vederle divise per mese sì.
  const groups = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const d = new Date(tx.occurred_at);
    const key = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(d);
    const bucket = groups.get(key);
    if (bucket) bucket.push(tx);
    else groups.set(key, [tx]);
  }

  return (
    <>
      <PageHeader title="Spese" subtitle={`${transactions.length} movimenti registrati`} />

      <div className="space-y-6">
        {[...groups].map(([month, items]) => {
          const monthTotal = items.reduce((sum, t) => sum + numericToCents(t.total_amount), 0);
          return (
            <section key={month} className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold capitalize text-fg">{month}</h2>
                <span className="tabular text-sm font-medium text-fg-muted">
                  {euro(monthTotal)}
                </span>
              </div>

              <ul className="space-y-2">
                {items.map((tx) => {
                  const vendor = Array.isArray(tx.vendor) ? tx.vendor[0] : tx.vendor;
                  const lineCount = Array.isArray(tx.line_item)
                    ? (tx.line_item[0]?.count ?? 0)
                    : 0;
                  return (
                    <li key={tx.id}>
                      <Link href={`/spese/${tx.id}`} className="block">
                        <Card className="flex items-center gap-3 p-3.5 transition-all active:scale-[0.99]">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg-muted">
                            <Store className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-fg">
                              {vendor?.name ?? 'Senza insegna'}
                            </p>
                            <p className="text-xs text-fg-muted">
                              {relativeDay(tx.occurred_at)}
                              {lineCount > 0 ? ` · ${lineCount} righe` : ''}
                            </p>
                          </div>
                          {tx.module !== 'spesa' ? <Badge>{tx.module}</Badge> : null}
                          <span className="tabular text-sm font-semibold text-fg">
                            {euro(numericToCents(tx.total_amount))}
                          </span>
                        </Card>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
