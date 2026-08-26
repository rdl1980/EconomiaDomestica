import { cache } from 'react';
import { numericToCents, numericToNumber, type Unit } from '@ed/db';
import type { Cents } from '@ed/core';
import { createClient } from '@/lib/supabase/server';

/**
 * Lettura dell'intelligenza sui prezzi.
 *
 * I prezzi unitari restano `number` a quattro decimali (esistono tariffe da
 * 0,0295 €/kWh); gli importi restano centesimi interi. Sono due grandezze
 * diverse e mescolarle sarebbe il modo piu' rapido per sbagliare i totali.
 */

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface ProductPriceSummary {
  productId: string;
  name: string;
  unit: Unit;
  observations: number;
  vendorCount: number;
  lastPrice: number | null;
  lastObservedOn: string | null;
  averagePrice: number | null;
  bestPrice: number | null;
  bestVendorName: string | null;
  worstPrice: number | null;
  spendCents: Cents;
  potentialSavingCents: Cents;
  /** true se ci sono abbastanza dati perché il confronto significhi qualcosa. */
  isReliable: boolean;
}

export const getProductPriceSummary = cache(
  async (householdId: string, months = 12, limit = 50): Promise<ProductPriceSummary[]> => {
    const supabase = await createClient();
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth() - months, 1);

    const { data } = await supabase.rpc('product_price_summary', {
      p_household: householdId,
      p_from: isoDate(from),
      p_to: isoDate(to),
      p_limit: limit,
    });

    return (data ?? []).map((r) => ({
      productId: r.product_id,
      name: r.product_name,
      unit: r.normalized_unit,
      observations: Number(r.observations),
      vendorCount: Number(r.vendor_count),
      lastPrice: r.last_price == null ? null : numericToNumber(r.last_price),
      lastObservedOn: r.last_observed_on,
      averagePrice: r.average_price == null ? null : numericToNumber(r.average_price),
      bestPrice: r.best_price == null ? null : numericToNumber(r.best_price),
      bestVendorName: r.best_vendor_name,
      worstPrice: r.worst_price == null ? null : numericToNumber(r.worst_price),
      spendCents: numericToCents(r.spend_total),
      potentialSavingCents: numericToCents(r.potential_saving),
      // Con un solo negozio non c'è confronto possibile, e con due sole
      // osservazioni la "media" è un caso.
      isReliable: Number(r.vendor_count) >= 2 && Number(r.observations) >= 3,
    }));
  },
);

export interface PricePoint {
  observedOn: string;
  vendorId: string | null;
  vendorName: string;
  price: number;
  unit: Unit;
  wasDiscounted: boolean;
}

export const getProductPriceHistory = cache(
  async (householdId: string, productId: string): Promise<PricePoint[]> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc('product_price_history', {
      p_household: householdId,
      p_product: productId,
    });

    return (data ?? []).map((r) => ({
      observedOn: r.observed_on,
      vendorId: r.vendor_id,
      vendorName: r.vendor_name,
      price: numericToNumber(r.unit_price_normalized),
      unit: r.normalized_unit,
      wasDiscounted: r.was_discounted,
    }));
  },
);

export interface VendorPrice {
  vendorId: string | null;
  vendorName: string;
  observations: number;
  averagePrice: number;
  bestPrice: number;
  lastPrice: number;
  lastObservedOn: string;
}

export const getProductPriceByVendor = cache(
  async (householdId: string, productId: string): Promise<VendorPrice[]> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc('product_price_by_vendor', {
      p_household: householdId,
      p_product: productId,
    });

    return (data ?? []).map((r) => ({
      vendorId: r.vendor_id,
      vendorName: r.vendor_name,
      observations: Number(r.observations),
      averagePrice: numericToNumber(r.average_price),
      bestPrice: numericToNumber(r.best_price),
      lastPrice: numericToNumber(r.last_price),
      lastObservedOn: r.last_observed_on,
    }));
  },
);

export interface InflationPoint {
  month: string;
  label: string;
  index: number | null;
  productCount: number;
}

export const getPersonalInflation = cache(
  async (householdId: string, months = 12): Promise<InflationPoint[]> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc('personal_inflation', {
      p_household: householdId,
      p_months: months,
    });

    const labelFmt = new Intl.DateTimeFormat('it-IT', { month: 'short' });
    return (data ?? []).map((r) => ({
      month: r.month,
      label: labelFmt.format(new Date(r.month)).replace('.', ''),
      index: r.index_value == null ? null : numericToNumber(r.index_value),
      productCount: Number(r.product_count),
    }));
  },
);

export interface Deal {
  productId: string;
  name: string;
  vendorName: string;
  unit: Unit;
  lastPrice: number;
  medianPrice: number;
  /** Sconto rispetto alla mediana storica, 0..1. */
  discountRatio: number;
  observedOn: string;
}

export const getRealDeals = cache(async (householdId: string, limit = 10): Promise<Deal[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc('real_deals', {
    p_household: householdId,
    p_min_observations: 4,
    p_limit: limit,
  });

  return (data ?? []).map((r) => ({
    productId: r.product_id,
    name: r.product_name,
    vendorName: r.vendor_name,
    unit: r.normalized_unit,
    lastPrice: numericToNumber(r.last_price),
    medianPrice: numericToNumber(r.median_price),
    discountRatio: numericToNumber(r.discount_ratio),
    observedOn: r.observed_on,
  }));
});
