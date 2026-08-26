import type { Metadata } from 'next';
import Link from 'next/link';
import { ReceiptText, SearchX, Store } from 'lucide-react';
import { numericToCents } from '@ed/db';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { filterPeriod, parseFilters, hasActiveFilters } from '@/lib/data/filters';
import { euro, relativeDay } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { ExpenseFilters } from './filters';

export const metadata: Metadata = { title: 'Spese' };

const PAGE_SIZE = 100;

export default async function SpesePage({ searchParams }: PageProps<'/spese'>) {
  const session = await requireSession();
  const householdId = session.household.id;
  const filters = parseFilters(await searchParams);
  const period = filterPeriod(filters.range);
  const supabase = await createClient();

  // Le opzioni dei filtri si caricano sempre: servono anche quando il risultato
  // corrente è vuoto, altrimenti l'utente resta bloccato senza poter allargare.
  const [{ data: vendorRows }, { data: categoryRows }] = await Promise.all([
    supabase.from('vendor').select('id, name').eq('household_id', householdId).order('name'),
    supabase
      .from('category')
      .select('slug, name, parent_id')
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .order('sort_order'),
  ]);

  /**
   * Categoria e ricerca testuale vivono sulle righe, non sulla testata: si
   * risolvono prima in un insieme di transazioni, e poi si filtra l'elenco.
   */
  let transactionIds: string[] | null = null;
  if (filters.categorySlug || filters.query) {
    let lineQuery = supabase
      .from('v_expense_line')
      .select('transaction_id')
      .eq('household_id', householdId)
      .limit(2000);

    if (filters.categorySlug) {
      lineQuery = lineQuery.or(
        `category_slug.eq.${filters.categorySlug},root_category_slug.eq.${filters.categorySlug}`,
      );
    }
    if (filters.query) {
      const term = filters.query.replace(/[%,()]/g, ' ');
      lineQuery = lineQuery.or(
        `raw_description.ilike.%${term}%,product_name.ilike.%${term}%,vendor_name.ilike.%${term}%`,
      );
    }
    if (period) {
      lineQuery = lineQuery
        .gte('occurred_at', period.start.toISOString())
        .lt('occurred_at', period.end.toISOString());
    }

    const { data: matches } = await lineQuery;
    transactionIds = [...new Set((matches ?? []).map((m) => m.transaction_id))];
  }

  let query = supabase
    .from('transaction')
    .select('id, occurred_at, total_amount, module, vendor:vendor_id(name), line_item(count)')
    .eq('household_id', householdId)
    .order('occurred_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (period) {
    query = query
      .gte('occurred_at', period.start.toISOString())
      .lt('occurred_at', period.end.toISOString());
  }
  if (filters.vendorId) query = query.eq('vendor_id', filters.vendorId);
  if (transactionIds !== null) {
    if (transactionIds.length === 0) {
      // Nessuna riga corrisponde: evitiamo una query `in ()` che PostgREST rifiuta.
      return (
        <>
          <PageHeader title="Spese" />
          <ExpenseFilters
            vendors={(vendorRows ?? []).map((v) => ({ value: v.id, label: v.name }))}
            categories={(categoryRows ?? []).map((c) => ({
              value: c.slug,
              label: c.parent_id ? `— ${c.name}` : c.name,
            }))}
          />
          <EmptyState
            icon={<SearchX />}
            title="Nessun risultato"
            description="Prova ad allargare il periodo o a togliere qualche filtro."
            action={
              <Button asChild variant="secondary">
                <Link href="/spese">Azzera i filtri</Link>
              </Button>
            }
          />
        </>
      );
    }
    query = query.in('id', transactionIds);
  }

  const { data: transactions } = await query;
  const rows = transactions ?? [];
  const filteredTotal = rows.reduce((sum, t) => sum + numericToCents(t.total_amount), 0);

  if (rows.length === 0) {
    const filtered = hasActiveFilters(filters);
    return (
      <>
        <PageHeader title="Spese" />
        <ExpenseFilters
          vendors={(vendorRows ?? []).map((v) => ({ value: v.id, label: v.name }))}
          categories={(categoryRows ?? []).map((c) => ({
            value: c.slug,
            label: c.parent_id ? `— ${c.name}` : c.name,
          }))}
        />
        <EmptyState
          icon={filtered ? <SearchX /> : <ReceiptText />}
          title={filtered ? 'Nessun risultato' : 'Ancora nessuna spesa'}
          description={
            filtered
              ? 'Prova ad allargare il periodo o a togliere qualche filtro.'
              : 'Appena confermi il primo scontrino lo trovi qui, con tutte le sue righe.'
          }
          action={
            <Button asChild variant={filtered ? 'secondary' : 'primary'}>
              <Link href={filtered ? '/spese' : '/cattura'}>
                {filtered ? 'Azzera i filtri' : 'Aggiungi uno scontrino'}
              </Link>
            </Button>
          }
        />
      </>
    );
  }

  // Raggruppa per mese: sessanta righe piatte non dicono niente, divise per mese sì.
  const groups = new Map<string, typeof rows>();
  for (const tx of rows) {
    const key = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(
      new Date(tx.occurred_at),
    );
    const bucket = groups.get(key);
    if (bucket) bucket.push(tx);
    else groups.set(key, [tx]);
  }

  return (
    <>
      <PageHeader
        title="Spese"
        subtitle={`${rows.length}${rows.length === PAGE_SIZE ? '+' : ''} ${
          rows.length === 1 ? 'movimento' : 'movimenti'
        } · ${euro(filteredTotal)}`}
      />

      <ExpenseFilters
        vendors={(vendorRows ?? []).map((v) => ({ value: v.id, label: v.name }))}
        categories={(categoryRows ?? []).map((c) => ({
          value: c.slug,
          label: c.parent_id ? `— ${c.name}` : c.name,
        }))}
      />

      <div className="space-y-6">
        {[...groups].map(([month, items]) => {
          const monthTotal = items.reduce((sum, t) => sum + numericToCents(t.total_amount), 0);
          return (
            <section key={month} className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold capitalize text-fg">{month}</h2>
                <span className="tabular text-sm font-medium text-fg-muted">{euro(monthTotal)}</span>
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
