import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Gauge, TrendingDown, TrendingUp } from 'lucide-react';
import { numericToCents, numericToNumber } from '@ed/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/primitives';
import { euro, fullDate } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { utilityConfig } from '@/lib/utilities/config';
import { NewBillForm } from './new-bill-form';
import { UtilitySeriesChart } from './series-chart';

export const metadata: Metadata = { title: 'Contratto' };

export default async function ContrattoPage({ params }: PageProps<'/altro/utenze/[id]'>) {
  const { id } = await params;
  const session = await requireSession();
  const householdId = session.household.id;
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from('utility_contract')
    .select('id, type, name, code, consumption_unit, started_on, vendor:vendor_id(name)')
    .eq('id', id)
    .maybeSingle();

  if (!contract) notFound();

  const [{ data: series }, { data: decomposition }] = await Promise.all([
    supabase.rpc('utility_series', { p_household: householdId, p_contract: id }),
    supabase.rpc('utility_decomposition', { p_household: householdId, p_contract: id }),
  ]);

  const config = utilityConfig(contract.type);
  const vendor = Array.isArray(contract.vendor) ? contract.vendor[0] : contract.vendor;
  const rows = (series ?? []).map((r) => ({
    billId: r.bill_id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    days: r.days,
    amountCents: numericToCents(r.amount),
    consumption: r.consumption === null ? null : numericToNumber(r.consumption),
    unitCost: r.unit_cost === null ? null : numericToNumber(r.unit_cost),
    dailyAmountCents: numericToCents(r.daily_amount),
    isEstimated: r.is_estimated,
  }));

  const latest = decomposition?.[0];

  return (
    <>
      <Link
        href="/altro/utenze"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Utenze
      </Link>

      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{contract.name}</h1>
        <p className="text-sm text-fg-muted">
          {config.label}
          {vendor ? ` · ${vendor.name}` : ''}
          {contract.code ? ` · ${contract.code}` : ''}
        </p>
      </header>

      <div className="space-y-4">
        {/* ------------------------------------------- prezzo o consumo? */}
        {latest &&
        latest.consumption_effect !== null &&
        latest.price_effect !== null ? (
          <Card>
            <CardHeader>
              <CardTitle>Cos&apos;è cambiato</CardTitle>
              <span className="tabular text-sm font-semibold text-fg">
                {numericToNumber(latest.amount_delta) > 0 ? '+' : '−'}
                {euro(Math.abs(numericToCents(latest.amount_delta)))}
                <span className="text-xs font-normal text-fg-subtle"> al giorno</span>
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs leading-relaxed text-fg-muted">
                Rispetto al periodo precedente, la variazione si scompone così:
              </p>

              <EffectRow
                icon={<Gauge className="size-4" />}
                label="Perché consumi diversamente"
                value={numericToNumber(latest.consumption_effect)}
              />
              <EffectRow
                icon={
                  numericToNumber(latest.price_effect) > 0 ? (
                    <TrendingUp className="size-4" />
                  ) : (
                    <TrendingDown className="size-4" />
                  )
                }
                label="Perché è cambiato il prezzo"
                value={numericToNumber(latest.price_effect)}
              />

              <p className="text-xs leading-relaxed text-fg-subtle">
                Con i soli euro questa distinzione non si potrebbe fare: è il motivo per cui vale la
                pena registrare il consumo insieme all&apos;importo.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* ------------------------------------------------------ andamento */}
        {rows.length >= 2 ? (
          <Card>
            <CardHeader>
              <CardTitle>Spesa e consumo</CardTitle>
            </CardHeader>
            <CardContent>
              <UtilitySeriesChart
                data={rows.map((r) => ({
                  label: new Intl.DateTimeFormat('it-IT', {
                    month: 'short',
                    year: '2-digit',
                  }).format(new Date(r.periodEnd)),
                  amountCents: r.amountCents,
                  consumption: r.consumption,
                }))}
                unit={contract.consumption_unit}
                color={config.color}
              />
            </CardContent>
          </Card>
        ) : null}

        {/* -------------------------------------------------------- bollette */}
        <Card>
          <CardHeader>
            <CardTitle>Bollette</CardTitle>
            <Badge>{rows.length}</Badge>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="py-4 text-center text-sm text-fg-subtle">
                Nessuna bolletta registrata.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {[...rows].reverse().map((row) => (
                  <li key={row.billId} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">
                        {fullDate(row.periodStart)} — {fullDate(row.periodEnd)}
                      </p>
                      <p className="text-xs text-fg-muted">
                        {row.days} giorni
                        {row.consumption !== null
                          ? ` · ${row.consumption} ${contract.consumption_unit ?? ''}`
                          : ''}
                        {row.unitCost !== null
                          ? ` · ${row.unitCost.toFixed(4).replace('.', ',')} €/${contract.consumption_unit}`
                          : ''}
                      </p>
                    </div>
                    {row.isEstimated ? <Badge tone="warning">stimata</Badge> : null}
                    <span className="tabular shrink-0 text-sm font-semibold text-fg">
                      {euro(row.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <NewBillForm
          contractId={contract.id}
          consumptionUnit={contract.consumption_unit}
          lastPeriodEnd={rows.at(-1)?.periodEnd ?? null}
        />
      </div>
    </>
  );
}

function EffectRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  const cents = Math.round(Math.abs(value) * 100);
  const isIncrease = value > 0;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
      <span className={isIncrease ? 'text-negative' : 'text-positive'}>{icon}</span>
      <span className="min-w-0 flex-1 text-xs text-fg-muted">{label}</span>
      <span
        className={`tabular shrink-0 text-sm font-semibold ${
          isIncrease ? 'text-negative' : 'text-positive'
        }`}
      >
        {isIncrease ? '+' : '−'}
        {euro(cents)}
      </span>
    </div>
  );
}
