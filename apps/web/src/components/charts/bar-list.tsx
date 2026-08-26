import { euro } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Cents } from '@ed/core';

/**
 * Elenco a barre orizzontali.
 *
 * Preferito a una ciambella per le ripartizioni: confrontare lunghezze è molto
 * più preciso che confrontare angoli, e ogni barra porta il proprio nome e il
 * proprio valore accanto. L'identità non è mai affidata al solo colore, e questo
 * rende leggibile il grafico anche in daltonismo, in stampa e in tema scuro.
 *
 * Oltre `maxItems` le voci si fondono in "Altro" invece di generare nuovi colori:
 * una palette categoriale ha un numero finito di tinte distinguibili.
 */

export interface BarListItem {
  key: string;
  label: string;
  color: string;
  valueCents: Cents;
  /** Riga secondaria sotto l'etichetta. */
  detail?: string;
}

export function BarList({
  items,
  maxItems = 7,
  emptyLabel = 'Nessun dato nel periodo.',
  className,
}: {
  items: BarListItem[];
  maxItems?: number;
  emptyLabel?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return <p className={cn('py-6 text-center text-sm text-fg-subtle', className)}>{emptyLabel}</p>;
  }

  const sorted = [...items].sort((a, b) => b.valueCents - a.valueCents);
  const head = sorted.slice(0, maxItems);
  const tail = sorted.slice(maxItems);

  const rows: BarListItem[] =
    tail.length > 0
      ? [
          ...head,
          {
            key: '__altro__',
            label: `Altro (${tail.length})`,
            color: 'var(--border-strong)',
            valueCents: tail.reduce((sum, i) => sum + i.valueCents, 0),
          },
        ]
      : head;

  const max = Math.max(...rows.map((r) => r.valueCents), 1);
  const total = rows.reduce((sum, r) => sum + r.valueCents, 0);

  return (
    <ul className={cn('space-y-3', className)}>
      {rows.map((row) => {
        const share = total === 0 ? 0 : row.valueCents / total;
        return (
          <li key={row.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
                <span className="truncate text-sm text-fg">{row.label}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="tabular text-sm font-medium text-fg">{euro(row.valueCents)}</span>
                <span className="tabular w-9 text-right text-xs text-fg-subtle">
                  {Math.round(share * 100)}%
                </span>
              </span>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.max(2, (row.valueCents / max) * 100)}%`,
                  background: row.color,
                }}
              />
            </div>

            {row.detail ? <p className="text-xs text-fg-subtle">{row.detail}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
