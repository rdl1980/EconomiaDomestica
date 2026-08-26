import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Tag, TrendingDown, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { InflationLine } from '@/components/charts/inflation-line';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { getPersonalInflation, getProductPriceSummary, getRealDeals } from '@/lib/data/prices';
import { euro, percent, shortDate, unitPrice as fmtUnitPrice } from '@/lib/format';
import { requireSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Prezzi' };

/** Sotto questa soglia l'indice è calcolato su troppi pochi prodotti per dire qualcosa. */
const MIN_PRODUCTS_FOR_INDEX = 8;

export default async function PrezziPage() {
  const session = await requireSession();
  const householdId = session.household.id;

  const [inflation, deals, products] = await Promise.all([
    getPersonalInflation(householdId, 12),
    getRealDeals(householdId, 8),
    getProductPriceSummary(householdId, 12, 50),
  ]);

  const comparable = products.filter((p) => p.isReliable);
  const totalSaving = comparable.reduce((sum, p) => sum + p.potentialSavingCents, 0);

  const latestIndex = [...inflation].reverse().find((p) => p.index !== null);
  const indexIsMeaningful =
    latestIndex !== undefined && latestIndex.productCount >= MIN_PRODUCTS_FOR_INDEX;

  if (products.length === 0) {
    return (
      <>
        <PageHeader title="Prezzi" subtitle="Dove conviene comprare cosa." />
        <EmptyState
          icon={<TrendingDown />}
          title="Serve un po' di storia"
          description="Il confronto fra negozi si accende quando lo stesso prodotto è stato comprato almeno due volte. Continua a caricare scontrini: da qualche settimana in poi questa pagina diventa la più utile dell'app."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Prezzi" subtitle="Dove conviene comprare cosa." />

      <div className="space-y-4">
        {/* -------------------------------------------------- inflazione personale */}
        <Card>
          <CardHeader>
            <CardTitle>La tua inflazione</CardTitle>
            {latestIndex && indexIsMeaningful ? (
              <span
                className={`tabular flex items-center gap-1 text-sm font-semibold ${
                  latestIndex.index! > 100 ? 'text-negative' : 'text-positive'
                }`}
              >
                {latestIndex.index! > 100 ? (
                  <TrendingUp className="size-4" />
                ) : (
                  <TrendingDown className="size-4" />
                )}
                {latestIndex.index! > 100 ? '+' : '−'}
                {Math.abs(latestIndex.index! - 100).toFixed(1)}%
              </span>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            <InflationLine data={inflation} />
            <p className="text-xs leading-relaxed text-fg-muted">
              {indexIsMeaningful ? (
                <>
                  Calcolata sul <span className="text-fg">tuo</span> paniere reale, non su quello
                  ISTAT: quanto costano oggi le cose che compri davvero, rispetto alla prima volta
                  che le hai comprate.
                </>
              ) : (
                <>
                  L&apos;indice è ancora calcolato su pochi prodotti
                  {latestIndex ? ` (${latestIndex.productCount})` : ''}: diventa attendibile
                  quando lo stesso paniere è stato ricomprato più volte. Fino ad allora la linea
                  qui sopra è indicativa.
                </>
              )}
            </p>
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------- offerte vere */}
        {deals.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Offerte vere</CardTitle>
              <Badge tone="positive">{deals.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs leading-relaxed text-fg-muted">
                Prezzi almeno il 10% sotto la loro mediana storica. Non quello che il cartello
                chiama offerta: quello che lo è davvero rispetto a quanto l&apos;hai pagato finora.
              </p>
              <ul className="space-y-2">
                {deals.map((deal) => (
                  <li key={`${deal.productId}-${deal.observedOn}`}>
                    <Link href={`/prezzi/${deal.productId}`} className="block">
                      <div className="flex items-center gap-3 rounded-xl bg-positive-soft p-3">
                        <Tag className="size-4 shrink-0 text-positive" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-fg">{deal.name}</p>
                          <p className="truncate text-xs text-fg-muted">
                            {deal.vendorName} · {shortDate(deal.observedOn)} · mediana{' '}
                            {fmtUnitPrice(deal.medianPrice, deal.unit)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tabular text-sm font-semibold text-positive">
                            −{percent(deal.discountRatio * 100)}
                          </p>
                          <p className="tabular text-xs text-fg-muted">
                            {fmtUnitPrice(deal.lastPrice, deal.unit)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {/* --------------------------------------------------- risparmio potenziale */}
        {comparable.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Dove stai lasciando soldi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs leading-relaxed text-fg-muted">
                Stima: comprando ogni prodotto dove costa meno avresti speso circa{' '}
                <span className="tabular font-medium text-fg">{euro(totalSaving)}</span> in meno
                nell&apos;ultimo anno. È una stima ottimistica — assume che il prezzo migliore
                fosse sempre disponibile — ma indica bene su cosa vale la pena guardare.
              </p>

              <ul className="divide-y divide-border">
                {comparable.slice(0, 15).map((product) => (
                  <li key={product.productId}>
                    <Link
                      href={`/prezzi/${product.productId}`}
                      className="flex items-center gap-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{product.name}</p>
                        <p className="truncate text-xs text-fg-muted">
                          {product.bestPrice !== null && product.worstPrice !== null ? (
                            <>
                              da {fmtUnitPrice(product.bestPrice, product.unit)} a{' '}
                              {fmtUnitPrice(product.worstPrice, product.unit)}
                            </>
                          ) : null}
                          {product.bestVendorName ? ` · meglio da ${product.bestVendorName}` : ''}
                        </p>
                      </div>
                      {product.potentialSavingCents > 0 ? (
                        <span className="tabular shrink-0 text-sm font-semibold text-positive">
                          {euro(product.potentialSavingCents)}
                        </span>
                      ) : null}
                      <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-5">
              <p className="text-xs leading-relaxed text-fg-muted">
                Nessun prodotto è ancora stato comprato in almeno due negozi diversi, quindi non
                c&apos;è niente da confrontare. Il confronto prezzi si accende da solo man mano che
                fai la spesa in posti diversi.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
