'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { euro, euroRound } from '@/lib/format';

/**
 * Spesa e consumo di un contratto nel tempo.
 *
 * Due grafici sovrapposti che condividono le stesse etichette sull'asse x, e
 * **non** un grafico a doppio asse. Due assi y su misure di scala diversa sono
 * l'errore più comune in questo tipo di visualizzazione: le due curve si
 * incrociano dove decide la scala scelta, e chi guarda ci legge una relazione
 * che non c'è. Con due riquadri separati il confronto resta possibile e non
 * suggerisce nulla di falso.
 */

export interface UtilityPoint {
  label: string;
  amountCents: number;
  consumption: number | null;
}

function AmountTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-lift">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="tabular text-sm font-semibold text-fg">{euro(payload[0]!.value)}</p>
    </div>
  );
}

function ConsumptionTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit: string | null;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-lift">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="tabular text-sm font-semibold text-fg">
        {payload[0]!.value} {unit}
      </p>
    </div>
  );
}

export function UtilitySeriesChart({
  data,
  unit,
  color,
}: {
  data: UtilityPoint[];
  unit: string | null;
  color: string;
}) {
  const hasConsumption = unit !== null && data.some((d) => d.consumption !== null);

  return (
    <div className="space-y-5">
      <figure className="space-y-1.5">
        <figcaption className="text-xs font-medium text-fg-muted">Importo</figcaption>
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={50}
                tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }}
                tickFormatter={(v: number) => euroRound(v)}
              />
              <Tooltip content={<AmountTooltip />} cursor={{ fill: 'var(--surface-2)', radius: 6 }} />
              <Bar
                dataKey="amountCents"
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>

      {hasConsumption ? (
        <figure className="space-y-1.5">
          <figcaption className="text-xs font-medium text-fg-muted">Consumo ({unit})</figcaption>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }}
                />
                <Tooltip
                  content={<ConsumptionTooltip unit={unit} />}
                  cursor={{ fill: 'var(--surface-2)', radius: 6 }}
                />
                <Bar
                  dataKey="consumption"
                  fill={color}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      ) : null}
    </div>
  );
}
