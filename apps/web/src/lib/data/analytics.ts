import { cache } from 'react';
import { percentChange, type Cents, type Period } from '@ed/core';
import { numericToCents, numericToNumber, type Unit } from '@ed/db';
import { createClient } from '@/lib/supabase/server';

/**
 * Lettura delle metriche di dashboard.
 *
 * Ogni funzione chiama una RPC che aggrega nel database e converte una volta
 * sola in centesimi interi. Da qui in poi nel codice non circolano più stringhe
 * numeriche.
 */

export interface PeriodSummary {
  totalCents: Cents;
  transactionCount: number;
  lineCount: number;
  averageTicketCents: Cents;
  discountCents: Cents;
  uncategorizedCents: Cents;
  /** Quota di spesa senza categoria, 0..1. Va mostrata, non nascosta. */
  uncategorizedShare: number;
}

const EMPTY_SUMMARY: PeriodSummary = {
  totalCents: 0,
  transactionCount: 0,
  lineCount: 0,
  averageTicketCents: 0,
  discountCents: 0,
  uncategorizedCents: 0,
  uncategorizedShare: 0,
};

export const getPeriodSummary = cache(
  async (householdId: string, period: Period): Promise<PeriodSummary> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc('dashboard_summary', {
      p_household: householdId,
      p_from: period.start.toISOString(),
      p_to: period.end.toISOString(),
    });

    const row = data?.[0];
    if (!row) return EMPTY_SUMMARY;

    const totalCents = numericToCents(row.total);
    const uncategorizedCents = numericToCents(row.uncategorized_total);

    return {
      totalCents,
      transactionCount: Number(row.transaction_count),
      lineCount: Number(row.line_count),
      averageTicketCents: numericToCents(row.average_ticket),
      discountCents: numericToCents(row.discount_total),
      uncategorizedCents,
      uncategorizedShare: totalCents === 0 ? 0 : uncategorizedCents / totalCents,
    };
  },
);

export interface CategorySlice {
  slug: string;
  name: string;
  color: string;
  totalCents: Cents;
  lineCount: number;
  /** Quota sul totale del periodo, 0..1. */
  share: number;
}

export const getSpendByCategory = cache(
  async (householdId: string, period: Period): Promise<CategorySlice[]> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc('spend_by_category', {
      p_household: householdId,
      p_from: period.start.toISOString(),
      p_to: period.end.toISOString(),
    });

    const rows = (data ?? []).map((r) => ({
      slug: r.slug,
      name: r.name,
      color: r.color,
      totalCents: numericToCents(r.total),
      lineCount: Number(r.line_count),
    }));

    const total = rows.reduce((sum, r) => sum + r.totalCents, 0);
    return rows.map((r) => ({ ...r, share: total === 0 ? 0 : r.totalCents / total }));
  },
);

export interface VendorSlice {
  vendorId: string | null;
  name: string;
  totalCents: Cents;
  transactionCount: number;
  averageTicketCents: Cents;
  share: number;
}

export const getSpendByVendor = cache(
  async (householdId: string, period: Period): Promise<VendorSlice[]> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc('spend_by_vendor', {
      p_household: householdId,
      p_from: period.start.toISOString(),
      p_to: period.end.toISOString(),
    });

    const rows = (data ?? []).map((r) => ({
      vendorId: r.vendor_id,
      name: r.name,
      totalCents: numericToCents(r.total),
      transactionCount: Number(r.transaction_count),
      averageTicketCents: numericToCents(r.average_ticket),
    }));

    const total = rows.reduce((sum, r) => sum + r.totalCents, 0);
    return rows.map((r) => ({ ...r, share: total === 0 ? 0 : r.totalCents / total }));
  },
);

export interface MonthPoint {
  month: string;
  label: string;
  totalCents: Cents;
  transactionCount: number;
}

export const getSpendByMonth = cache(
  async (householdId: string, months = 12): Promise<MonthPoint[]> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc('spend_by_month', {
      p_household: householdId,
      p_months: months,
    });

    const labelFmt = new Intl.DateTimeFormat('it-IT', { month: 'short' });
    return (data ?? []).map((r) => ({
      month: r.month,
      label: labelFmt.format(new Date(r.month)).replace('.', ''),
      totalCents: numericToCents(r.total),
      transactionCount: Number(r.transaction_count),
    }));
  },
);

export interface ProductSlice {
  productId: string;
  name: string;
  color: string;
  totalCents: Cents;
  times: number;
  totalQuantity: number;
  unit: Unit;
}

export const getTopProducts = cache(
  async (householdId: string, period: Period, limit = 10): Promise<ProductSlice[]> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc('top_products', {
      p_household: householdId,
      p_from: period.start.toISOString(),
      p_to: period.end.toISOString(),
      p_limit: limit,
    });

    return (data ?? []).map((r) => ({
      productId: r.product_id,
      name: r.name,
      color: r.category_color,
      totalCents: numericToCents(r.total),
      times: Number(r.times),
      totalQuantity: numericToNumber(r.total_quantity),
      unit: r.unit,
    }));
  },
);

/**
 * Confronto fra due periodi.
 *
 * Se il periodo corrente è ancora in corso, confrontare il suo totale parziale
 * con un mese intero produce sempre un calo fittizio. Qui si restituiscono
 * entrambe le letture: il confronto grezzo e quello a parità di giorni
 * trascorsi, e la UI dichiara quale sta mostrando.
 */
export interface Comparison {
  current: PeriodSummary;
  previous: PeriodSummary;
  /** Variazione grezza sui totali pieni. Null quando il periodo base è a zero. */
  rawChange: number | null;
  /** Proiezione del periodo corrente a fine periodo, se ha senso. */
  projectedCents: Cents | null;
  /** Variazione della proiezione rispetto al periodo precedente. */
  projectedChange: number | null;
  isPartial: boolean;
}

export async function comparePeriods(
  householdId: string,
  current: Period,
  previous: Period,
): Promise<Comparison> {
  const [currentSummary, previousSummary] = await Promise.all([
    getPeriodSummary(householdId, current),
    getPeriodSummary(householdId, previous),
  ]);

  const projectedCents =
    current.isPartial && current.elapsedFraction >= 0.15
      ? Math.round(currentSummary.totalCents / current.elapsedFraction)
      : null;

  return {
    current: currentSummary,
    previous: previousSummary,
    rawChange: percentChange(currentSummary.totalCents, previousSummary.totalCents),
    projectedCents,
    projectedChange:
      projectedCents === null
        ? null
        : percentChange(projectedCents, previousSummary.totalCents),
    isPartial: current.isPartial,
  };
}
