import { currentMonth, lastDays, monthPeriod, yearPeriod, type Period } from '@ed/core';

/**
 * Filtri dell'elenco spese.
 *
 * Vivono nella query string, non nello stato del componente: così una vista
 * filtrata è condivisibile con un link, sopravvive al ricaricamento e al tasto
 * indietro. È anche il motivo per cui i valori sono stringhe corte e leggibili.
 */

export const RANGE_OPTIONS = [
  { value: 'mese', label: 'Questo mese' },
  { value: '30g', label: 'Ultimi 30 giorni' },
  { value: '90g', label: 'Ultimi 90 giorni' },
  { value: 'anno', label: "Quest'anno" },
  { value: 'tutto', label: 'Tutto' },
] as const;

export type RangeValue = (typeof RANGE_OPTIONS)[number]['value'];

export interface ExpenseFilters {
  range: RangeValue;
  vendorId: string | null;
  categorySlug: string | null;
  query: string | null;
}

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): ExpenseFilters {
  const first = (key: string): string | null => {
    const raw = searchParams[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value && value.trim().length > 0 ? value.trim() : null;
  };

  const rawRange = first('periodo');
  const range = (RANGE_OPTIONS.find((o) => o.value === rawRange)?.value ?? 'mese') as RangeValue;

  return {
    range,
    vendorId: first('negozio'),
    categorySlug: first('categoria'),
    query: first('q'),
  };
}

/** Il periodo corrispondente al filtro, oppure null per "tutto". */
export function filterPeriod(range: RangeValue, now = new Date()): Period | null {
  switch (range) {
    case 'mese':
      return currentMonth(now);
    case '30g':
      return lastDays(30, now);
    case '90g':
      return lastDays(90, now);
    case 'anno':
      return yearPeriod(now.getFullYear(), now);
    case 'tutto':
      return null;
  }
}

/** Periodo di confronto: serve solo dove il confronto ha senso. */
export function comparisonPeriod(range: RangeValue, now = new Date()): Period | null {
  if (range !== 'mese') return null;
  const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return monthPeriod(ref.getFullYear(), ref.getMonth(), now);
}

export function hasActiveFilters(filters: ExpenseFilters): boolean {
  return (
    filters.range !== 'mese' ||
    filters.vendorId !== null ||
    filters.categorySlug !== null ||
    filters.query !== null
  );
}
