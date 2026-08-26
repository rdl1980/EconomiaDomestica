'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { UNITS } from '@ed/core';
import { getCategoryMap } from '@/lib/data/catalog';
import { canEdit, requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export interface CatalogActionResult {
  error?: string;
  ok?: boolean;
}

const updateSchema = z.object({
  productId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(120).nullable(),
  categorySlug: z.string().trim().min(1),
  defaultUnit: z.enum(UNITS),
  packageSize: z.number().positive().nullable(),
  packageUnit: z.enum(UNITS).nullable(),
});

export async function updateProduct(input: unknown): Promise<CatalogActionResult> {
  const session = await requireSession();
  if (!canEdit(session)) return { error: 'Non hai i permessi per modificare il catalogo.' };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' };
  const p = parsed.data;

  const categoryMap = await getCategoryMap(session.household.id);
  const supabase = await createClient();

  const { error } = await supabase
    .from('product')
    .update({
      name: p.name,
      brand: p.brand,
      default_category_id: categoryMap.get(p.categorySlug) ?? null,
      default_unit: p.defaultUnit,
      package_size: p.packageSize === null ? null : p.packageSize.toFixed(3),
      package_unit: p.packageUnit,
    })
    .eq('id', p.productId);

  if (error) return { error: error.message };

  revalidatePath('/altro/prodotti');
  revalidatePath('/prezzi');
  return { ok: true };
}

/**
 * Fonde due prodotti.
 *
 * Passa dalla funzione SQL perché tocca righe, alias e storico prezzi: se
 * fallisse a metà resterebbe uno storico prezzi spezzato, cioè esattamente il
 * dato su cui poggia tutta la pagina Prezzi.
 */
export async function mergeProducts(
  sourceId: string,
  targetId: string,
): Promise<CatalogActionResult> {
  const session = await requireSession();
  if (!canEdit(session)) return { error: 'Non hai i permessi per modificare il catalogo.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('merge_products', {
    p_source: sourceId,
    p_target: targetId,
  });

  if (error) return { error: error.message };

  revalidatePath('/altro/prodotti');
  revalidatePath('/prezzi');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteAlias(aliasId: string): Promise<CatalogActionResult> {
  const session = await requireSession();
  if (!canEdit(session)) return { error: 'Non hai i permessi per modificare il catalogo.' };

  const supabase = await createClient();
  const { error } = await supabase.from('product_alias').delete().eq('id', aliasId);
  if (error) return { error: error.message };

  revalidatePath('/altro/prodotti');
  return { ok: true };
}
