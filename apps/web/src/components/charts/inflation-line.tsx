'use client';

import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Inflazione personale: indice 100 = prezzo del primo mese in cui ogni prodotto
 * compare, pesato per quanto quel prodotto incide sulla spesa.
 *
 * Una serie sola, quindi niente legenda. La linea di riferimento a 100 è
 * necessaria: senza, un indice a 104 e uno a 96 si somigliano, mentre significano
 * cose opposte.
 */

export interface InflationPointData {
  month: string;
  label: string;
  index: number | null;
  productCount: number;
}

function InflationTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: InflationPointData }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point || point.index === null) return null;

  const delta = point.index - 100;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-lift">
      <p className="text-xs font-medium capitalize text-fg-muted">
        {new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(
          new Date(point.month),
        )}
      </p>
      <p className="tabular text-sm font-semibold text-fg">
        {delta > 0 ? '+' : delta < 0 ? '−' : ''}
        {Math.abs(delta).toFixed(1)}%
      </p>
      <p className="text-xs text-fg-subtle">
        su {point.productCount} {point.productCount === 1 ? 'prodotto' : 'prodotti'}
      </p>
    </div>
  );
}

export function InflationLine({ data }: { data: InflationPointData[] }) {
  const values = data.map((d) => d.index).filter((v): v is number => v !== null);
  const min = Math.min(100, ...values);
  const max = Math.max(100, ...values);
  const pad = Math.max(2, (max - min) * 0.2);

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="inflation-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
            interval={0}
          />
          <YAxis
            domain={[min - pad, max + pad]}
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
            tickFormatter={(v: number) => v.toFixed(0)}
          />
          <ReferenceLine
            y={100}
            stroke="var(--border-strong)"
            strokeDasharray="4 4"
            label={{ value: 'base', position: 'right', fill: 'var(--fg-subtle)', fontSize: 10 }}
          />
          <Tooltip content={<InflationTooltip />} cursor={{ stroke: 'var(--border-strong)' }} />
          <Area
            type="monotone"
            dataKey="index"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#inflation-fill)"
            connectNulls
            dot={{ r: 3, fill: 'var(--surface)', stroke: 'var(--primary)', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
