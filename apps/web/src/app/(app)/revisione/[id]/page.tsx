import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { parseReceiptDraft, prepareReceipt } from '@ed/core';
import { getCatalogContext, getCategories } from '@/lib/data/catalog';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { ReviewForm } from './review-form';

export const metadata: Metadata = { title: 'Rivedi lo scontrino' };

export default async function RevisionePage({ params }: PageProps<'/revisione/[id]'>) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data: document } = await supabase
    .from('document')
    .select('id, status, draft, source, storage_path')
    .eq('id', id)
    .maybeSingle();

  if (!document) notFound();
  if (document.status === 'confirmed') redirect('/spese');

  const parsed = parseReceiptDraft(document.draft);
  if (!parsed.ok) {
    return (
      <div className="space-y-3 rounded-[var(--radius-card)] border border-negative-soft bg-negative-soft p-5">
        <p className="font-medium text-negative">Questo documento non è leggibile</p>
        <ul className="space-y-1">
          {parsed.errors.slice(0, 8).map((e) => (
            <li key={e} className="font-mono text-[11px] text-negative">
              {e}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const [catalog, categories] = await Promise.all([
    getCatalogContext(session.household.id),
    getCategories(session.household.id),
  ]);

  const prepared = prepareReceipt(parsed.draft, catalog);

  // Solo i dati che servono al form: il catalogo intero non deve attraversare
  // il confine server/client a ogni revisione.
  const vendorOptions = catalog.vendors.map((v) => ({ id: v.id, name: v.name, city: v.city ?? null }));
  const categoryOptions = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    color: c.color,
    parent: c.parent_id,
  }));

  return (
    <ReviewForm
      documentId={document.id}
      prepared={prepared}
      vendorOptions={vendorOptions}
      categoryOptions={categoryOptions}
    />
  );
}
