import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Camera, TriangleAlert } from 'lucide-react';
import { currentMonth, previousMonth } from '@ed/core';
import { PageHeader } from '@/components/layout/page-header';
import { BarList } from '@/components/charts/bar-list';
import { MonthlyTrend } from '@/components/charts/monthly-trend';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Delta, EmptyState } from '@/components/ui/primitives';
import {
  comparePeriods,
  getSpendByCategory,
  getSpendByMonth,
  getSpendByVendor,
  getTopProducts,
} from '@/lib/data/analytics';
import { euro, euroParts, percent, quantity as fmtQuantity } from '@/lib/format';
import { requireSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Riepilogo' };

export default async function DashboardPage() {
  const session = await requireSession();
  const householdId = session.household.id;

  const period = currentMonth();
  const previous = previousMonth();

  const [comparison, categories, vendors, months, products] = await Promise.all([
    comparePeriods(householdId, period, previous),
    getSpendByCategory(householdId, period),
    getSpendByVendor(householdId, period),
    getSpendByMonth(householdId, 12),
    getTopProducts(householdId, period, 8),
  ]);

  const hasHistory = months.some((m) => m.totalCents > 0);

  if (!hasHistory) {
    return (
      <>
        <PageHeader
          title={`Ciao, ${session.member.display_name}`}
          subtitle={session.household.name}
        />
        <EmptyState
          icon={<Camera />}
          title="Non c'è ancora niente da mostrare"
          description="Carica il primo scontrino: bastano una foto, un file JSON già pronto o due righe scritte a mano."
          action={
            <Button asChild size="lg">
              <Link href="/cattura">Aggiungi uno scontrino</Link>
            </Button>
          }
        />
      </>
    );
  }

  const { current, projectedCents, rawChange, projectedChange, isPartial } = comparison;
  const total = euroParts(current.totalCents);
  const coverageIssue = current.uncategorizedShare > 0.1;

  return (
    <>
      <PageHeader
        title={`Ciao, ${session.member.display_name}`}
        subtitle={session.household.name}
      />

      {/* ------------------------------------------------------------- totale */}
      <Card className="mb-4 overflow-hidden">
        <CardContent className="space-y-3 p-5 pt-5">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium capitalize text-fg-muted">{period.label}</p>
            {isPartial ? (
              <span className="text-[11px] text-fg-subtle">
                mese in corso · {Math.round(period.elapsedFraction * 100)}%
              </span>
            ) : null}
          </div>

          <p className="tabular flex items-baseline gap-0.5 text-5xl font-semibold tracking-tight text-fg">
            {total.whole}
            <span className="text-2xl text-fg-subtle">,{total.decimals}</span>
            <span className="ml-1 text-2xl text-fg-subtle">€</span>
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
            <span className="flex items-center gap-1.5">
              <Delta value={isPartial ? projectedChange : rawChange} />
              rispetto a {previous.label.split(' ')[0]}
            </span>
            <span>
              {current.transactionCount === 1
                ? '1 spesa'
                : `${current.transactionCount} spese`}{' '}
              · scontrino medio {euro(current.averageTicketCents)}
            </span>
          </div>

          {isPartial && projectedCents !== null ? (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs leading-relaxed text-fg-muted">
              Il mese non è finito: di questo passo chiuderai intorno a{' '}
              <span className="tabular font-medium text-fg">{euro(projectedCents)}</span>. Il
              confronto qui sopra usa la proiezione, non il parziale.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- copertura dati */}
      {coverageIssue ? (
        <div className="mb-4 flex gap-3 rounded-[var(--radius-card)] border border-warning-soft bg-warning-soft p-4">
          <TriangleAlert className="size-5 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-fg-muted">
            <span className="font-medium text-fg">
              {percent(current.uncategorizedShare * 100)} della spesa
            </span>{' '}
            non ha una categoria ({euro(current.uncategorizedCents)}). Finché resta così, la
            ripartizione qui sotto racconta solo una parte della storia.
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        {/* ------------------------------------------------------------- trend */}
        <Card>
          <CardHeader>
            <CardTitle>Ultimi 12 mesi</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyTrend data={months} />
          </CardContent>
        </Card>

        {/* -------------------------------------------------------- categorie */}
        <Card>
          <CardHeader>
            <CardTitle>Dove sono finiti i soldi</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              items={categories.map((c) => ({
                key: c.slug,
                label: c.name,
                color: c.color,
                valueCents: c.totalCents,
              }))}
              emptyLabel="Nessuna spesa categorizzata in questo mese."
            />
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------- negozi */}
        <Card>
          <CardHeader>
            <CardTitle>Per negozio</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              items={vendors.map((v, index) => ({
                key: v.vendorId ?? `senza-${index}`,
                label: v.name,
                // Le insegne non hanno un colore proprio: la loro identità è il
                // nome, e una tinta diversa per ognuna sarebbe rumore.
                color: 'var(--primary)',
                valueCents: v.totalCents,
                detail: `${v.transactionCount} ${
                  v.transactionCount === 1 ? 'visita' : 'visite'
                } · scontrino medio ${euro(v.averageTicketCents)}`,
              }))}
              emptyLabel="Nessuna spesa in questo mese."
            />
          </CardContent>
        </Card>

        {/* -------------------------------------------------------- prodotti */}
        {products.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Prodotti che pesano di più</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList
                maxItems={8}
                items={products.map((p) => ({
                  key: p.productId,
                  label: p.name,
                  color: p.color,
                  valueCents: p.totalCents,
                  detail: `${p.times}× · ${fmtQuantity(p.totalQuantity, p.unit)}`,
                }))}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex gap-3 p-5">
              <AlertTriangle className="size-5 shrink-0 text-fg-subtle" />
              <p className="text-xs leading-relaxed text-fg-muted">
                Nessuna riga è ancora agganciata a un prodotto del catalogo. Succede in automatico
                man mano che confermi gli scontrini: dal secondo o terzo dello stesso negozio,
                l&apos;app riconosce quasi tutto da sola.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
