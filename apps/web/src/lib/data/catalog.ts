import { cache } from 'react';
import type { CatalogContext } from '@ed/core';
import type { CategoryRow, Unit } from '@ed/db';
import { createClient } from '@/lib/supabase/server';

/**
 * Contesto di catalogo per la preparazione di uno scontrino.
 *
 * Si carica in blocco e si passa alle funzioni pure di `@ed/core`. Per un
 * household reale sono poche centinaia di righe: caricarle tutte costa meno di
 * una query per riga di scontrino, e permette al matching di girare senza
 * round-trip.
 */
export const getCatalogContext = cache(
  async (householdId: string): Promise<CatalogContext> => {
    const supabase = await createClient();

    const [vendors, products, aliases] = await Promise.all([
      supabase
        .from('vendor')
        .select('id, name, city')
        .eq('household_id', householdId),
      supabase
        .from('product')
        .select('id, name, brand, default_category_id, package_size, package_unit')
        .eq('household_id', householdId),
      supabase
        .from('product_alias')
        .select('normalized, product_id, vendor_id')
        .eq('household_id', householdId),
    ]);

    const categoryBySlug = await getCategoryMap(householdId);
    const slugById = new Map([...categoryBySlug].map(([slug, id]) => [id, slug] as const));

    const productCategoryBySlug: Record<string, string> = {};
    const productPackage: Record<string, { size: number; unit: Unit }> = {};

    for (const p of products.data ?? []) {
      const slug = p.default_category_id ? slugById.get(p.default_category_id) : undefined;
      if (slug) productCategoryBySlug[p.id] = slug;
      if (p.package_size && p.package_unit) {
        productPackage[p.id] = { size: Number(p.package_size), unit: p.package_unit };
      }
    }

    return {
      vendors: (vendors.data ?? []).map((v) => ({ id: v.id, name: v.name, city: v.city })),
      products: (products.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
      })),
      aliases: (aliases.data ?? []).map((a) => ({
        normalized: a.normalized,
        productId: a.product_id,
        vendorId: a.vendor_id,
      })),
      productCategoryBySlug,
      productPackage,
    };
  },
);

/** slug -> id, categorie di sistema più quelle custom dell'household. */
export const getCategoryMap = cache(
  async (householdId: string): Promise<Map<string, string>> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('category')
      .select('id, slug, household_id')
      .or(`household_id.is.null,household_id.eq.${householdId}`);

    const map = new Map<string, string>();
    for (const row of data ?? []) {
      // Una categoria custom con lo stesso slug di una di sistema vince: è una
      // personalizzazione voluta dall'household.
      if (row.household_id !== null || !map.has(row.slug)) map.set(row.slug, row.id);
    }
    return map;
  },
);

export const getCategories = cache(async (householdId: string): Promise<CategoryRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('category')
    .select('*')
    .or(`household_id.is.null,household_id.eq.${householdId}`)
    .order('sort_order');
  return data ?? [];
});
