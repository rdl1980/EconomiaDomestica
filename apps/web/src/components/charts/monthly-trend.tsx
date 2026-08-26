'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { euro, euroRound } from '@/lib/format';

/**
 * Andamento mensile della spesa.
 *
 * Una serie sola: niente legenda, il titolo della card dice già cosa sono le
 * barre. Il mese in corso è disegnato con un tratteggio più chiaro perché è
 * **parziale**: affiancarlo a pieno colore ai mesi completi suggerirebbe un calo
 * che non è avvenuto. È lo stesso motivo per cui il confronto in dashboard
 * dichiara sempre se sta guardando un periodo incompleto.
 */

export interface MonthlyPoint {
  month: string;
  label: string;
  totalCents: number;
  transactionCount: number;
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: MonthlyPoint }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-lift">
      <p className="text-xs font-medium capitalize text-fg-muted">
        {new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(
          new Date(point.month),
        )}
      </p>
      <p className="tabular text-sm font-semibold text-fg">{euro(point.totalCents)}</p>
      <p className="text-xs text-fg-subtle">
        {point.transactionCount === 1 ? '1 spesa' : `${point.transactionCount} spese`}
      </p>
    </div>
  );
}

export function MonthlyTrend({ data }: { data: MonthlyPoint[] }) {
  const currentMonth = data.at(-1)?.month;

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barCategoryGap="22%">
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
            interval={0}
            minTickGap={0}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
            tickFormatter={(value: number) => euroRound(value)}
          />
          <Tooltip
            content={<TrendTooltip />}
            cursor={{ fill: 'var(--surface-2)', radius: 8 }}
          />
          <Bar dataKey="totalCents" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((point) => (
              <Cell
                key={point.month}
                fill="var(--primary)"
                // Mese in corso: parziale, quindi visivamente attenuato.
                fillOpacity={point.month === currentMonth ? 0.4 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
