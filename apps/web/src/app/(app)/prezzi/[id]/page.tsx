import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Crown } from 'lucide-react';
import type { Unit } from '@ed/db';
import { PriceHistoryChart, type PriceSeries } from '@/components/charts/price-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/primitives';
import { fullDate, unitPrice as fmtUnitPrice } from '@/lib/format';
import { getProductPriceByVendor, getProductPriceHistory } from '@/lib/data/prices';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Prezzo del prodotto' };

/** Massimo di insegne nel grafico: oltre, le linee diventano illeggibili. */
const MAX_VENDORS = 6;

export default async function PrezzoProdottoPage({ params }: PageProps<'/prezzi/[id]'>) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data: product } = await supabase
    .from('product')
    .select('id, name, brand, package_size, package_unit')
    .eq('id', id)
    .maybeSingle();

  if (!product) notFound();

  const [history, byVendor] = await Promise.all([
    getProductPriceHistory(session.household.id, id),
    getProductPriceByVendor(session.household.id, id),
  ]);

  const unit: Unit = history[0]?.unit ?? 'pcs';

  // Le insegne sono ordinate per prezzo medio: la prima voce risponde già alla
  // domanda "dove conviene".
  const ranked = byVendor.slice(0, MAX_VENDORS);
  const series: PriceSeries[] = ranked.map((vendor) => ({
    vendorName: vendor.vendorName,
    points: history
      .filter((p) => p.vendorName === vendor.vendorName)
      .map((p) => ({ observedOn: p.observedOn, price: p.price })),
  }));

  const best = byVendor[0];
  const worst = byVendor.at(-1);
  const spread =
    best && worst && best.averagePrice > 0 && worst.vendorName !== best.vendorName
      ? worst.averagePrice / best.averagePrice - 1
      : null;

  return (
    <>
      <Link
        href="/prezzi"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Prezzi
      </Link>

      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{product.name}</h1>
        <p className="text-sm text-fg-muted">
          {product.brand ? `${product.brand} · ` : ''}
          {history.length} {history.length === 1 ? 'rilevazione' : 'rilevazioni'} · prezzi in{' '}
          {unit === 'kg' ? '€/kg' : unit === 'l' ? '€/L' : '€/pz'}
        </p>
      </header>

      {spread !== null && spread > 0.05 ? (
        <Card className="mb-4 border-primary-soft bg-primary-soft">
          <CardContent className="flex gap-3 p-4">
            <Crown className="size-5 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-fg-muted">
              Da <span className="font-medium text-fg">{worst!.vendorName}</span> lo paghi in media{' '}
              <span className="tabular font-medium text-fg">
                {Math.round(spread * 100)}% in più
              </span>{' '}
              che da <span className="font-medium text-fg">{best!.vendorName}</span>.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Andamento</CardTitle>
          </CardHeader>
          <CardContent>
            <PriceHistoryChart series={series} unit={unit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per negozio</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {byVendor.map((vendor, index) => (
                <li
                  key={vendor.vendorId ?? vendor.vendorName}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-fg">
                      {vendor.vendorName}
                      {index === 0 && byVendor.length > 1 ? (
                        <Badge tone="positive">più conveniente</Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-fg-muted">
                      {vendor.observations}{' '}
                      {vendor.observations === 1 ? 'rilevazione' : 'rilevazioni'} · ultima{' '}
                      {fullDate(vendor.lastObservedOn)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        'tabular text-sm font-semibold',
                        index === 0 && byVendor.length > 1 ? 'text-positive' : 'text-fg',
                      )}
                    >
                      {fmtUnitPrice(vendor.averagePrice, unit)}
                    </p>
                    <p className="tabular text-xs text-fg-subtle">
                      min {fmtUnitPrice(vendor.bestPrice, unit)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {byVendor.length > MAX_VENDORS ? (
              <p className="pt-3 text-xs text-fg-subtle">
                Il grafico mostra le prime {MAX_VENDORS} insegne per convenienza; la tabella le
                elenca tutte.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
