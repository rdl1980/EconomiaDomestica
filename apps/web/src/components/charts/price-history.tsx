'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { seriesColor } from '@/lib/chart-palette';
import { unitPrice as fmtUnitPrice } from '@/lib/format';
import type { Unit } from '@ed/db';

/**
 * Prezzo normalizzato di un prodotto nel tempo, una linea per insegna.
 *
 * Più serie, quindi la legenda è obbligatoria: l'identità non può stare nel solo
 * colore. Le insegne sono ordinate per prezzo medio crescente, così la prima
 * voce della legenda è anche la risposta alla domanda "dove conviene".
 */

export interface PriceSeries {
  vendorName: string;
  points: { observedOn: string; price: number }[];
}

interface ChartRow {
  date: string;
  label: string;
  [vendor: string]: string | number;
}

function PriceTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  unit: Unit;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="space-y-1 rounded-xl border border-border bg-surface px-3 py-2 shadow-lift">
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2 text-xs">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="text-fg-muted">{entry.name}</span>
          <span className="tabular font-medium text-fg">{fmtUnitPrice(entry.value, unit)}</span>
        </p>
      ))}
    </div>
  );
}

export function PriceHistoryChart({
  series,
  unit,
}: {
  series: PriceSeries[];
  unit: Unit;
}) {
  const { rows, vendors } = useMemo(() => {
    const byDate = new Map<string, ChartRow>();
    const labelFmt = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' });

    for (const s of series) {
      for (const point of s.points) {
        let row = byDate.get(point.observedOn);
        if (!row) {
          row = {
            date: point.observedOn,
            label: labelFmt.format(new Date(point.observedOn)).replace('.', ''),
          };
          byDate.set(point.observedOn, row);
        }
        row[s.vendorName] = point.price;
      }
    }

    return {
      rows: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
      vendors: series.map((s) => s.vendorName),
    };
  }, [series]);

  if (rows.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-fg-subtle">
        Serve almeno una seconda rilevazione per disegnare un andamento.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
              tickFormatter={(v: number) => v.toFixed(2)}
              domain={['auto', 'auto']}
            />
            <Tooltip
              content={<PriceTooltip unit={unit} />}
              cursor={{ stroke: 'var(--border-strong)' }}
            />
            {vendors.map((vendor, index) => (
              <Line
                key={vendor}
                type="monotone"
                dataKey={vendor}
                stroke={seriesColor(index)}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface)' }}
                activeDot={{ r: 6 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {vendors.map((vendor, index) => (
          <li key={vendor} className="flex items-center gap-1.5 text-xs text-fg-muted">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ background: seriesColor(index) }}
            />
            {vendor}
          </li>
        ))}
      </ul>
    </div>
  );
}
