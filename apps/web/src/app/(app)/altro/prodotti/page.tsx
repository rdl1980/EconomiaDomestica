import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Tags } from 'lucide-react';
import { numericToCents, numericToNumber } from '@ed/db';
import { EmptyState } from '@/components/ui/primitives';
import { getCategories } from '@/lib/data/catalog';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { CatalogList, type CatalogEntry } from './catalog-list';

export const metadata: Metadata = { title: 'Catalogo prodotti' };

export default async function ProdottiPage() {
  const session = await requireSession();
  const householdId = session.household.id;
  const supabase = await createClient();

  const [{ data: catalog }, { data: aliases }, categories] = await Promise.all([
    supabase.rpc('product_catalog', { p_household: householdId }),
    supabase
      .from('product_alias')
      .select('id, product_id, normalized, vendor:vendor_id(name)')
      .eq('household_id', householdId),
    getCategories(householdId),
  ]);

  const aliasesByProduct = new Map<string, { id: string; normalized: string; vendor: string | null }[]>();
  for (const alias of aliases ?? []) {
    const vendor = Array.isArray(alias.vendor) ? alias.vendor[0] : alias.vendor;
    const bucket = aliasesByProduct.get(alias.product_id) ?? [];
    bucket.push({ id: alias.id, normalized: alias.normalized, vendor: vendor?.name ?? null });
    aliasesByProduct.set(alias.product_id, bucket);
  }

  const entries: CatalogEntry[] = (catalog ?? []).map((row) => ({
    productId: row.product_id,
    name: row.name,
    brand: row.brand,
    defaultUnit: row.default_unit,
    categorySlug: row.category_slug ?? 'non-categorizzato',
    categoryName: row.category_name ?? 'Da categorizzare',
    categoryColor: row.category_color ?? '#94a3b8',
    packageSize: row.package_size === null ? null : numericToNumber(row.package_size),
    packageUnit: row.package_unit,
    lineCount: Number(row.line_count),
    spendCents: numericToCents(row.spend_total),
    lastBought: row.last_bought,
    aliases: aliasesByProduct.get(row.product_id) ?? [],
  }));

  return (
    <>
      <Link
        href="/altro"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Altro
      </Link>

      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Catalogo prodotti</h1>
        <p className="text-sm text-fg-muted">
          {entries.length} {entries.length === 1 ? 'prodotto' : 'prodotti'} imparati dai tuoi
          scontrini.
        </p>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Tags />}
          title="Il catalogo è vuoto"
          description="Si riempie da solo: ogni riga che confermi in revisione diventa un prodotto, e le abbreviazioni dello scontrino diventano i suoi alias."
        />
      ) : (
        <CatalogList
          entries={entries}
          categories={categories.map((c) => ({
            slug: c.slug,
            name: c.parent_id ? `— ${c.name}` : c.name,
          }))}
        />
      )}
    </>
  );
}
