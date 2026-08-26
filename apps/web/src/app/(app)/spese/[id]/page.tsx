import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { numericToCents, numericToNumber, type Unit } from '@ed/db';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/primitives';
import { euro, dateTime, quantity as fmtQuantity, unitPrice as fmtUnitPrice } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Dettaglio spesa' };

export default async function SpesaDetailPage({ params }: PageProps<'/spese/[id]'>) {
  const { id } = await params;
  await requireSession();
  const supabase = await createClient();

  const { data: tx } = await supabase
    .from('transaction')
    .select(
      'id, occurred_at, total_amount, discount_total, payment_method, notes, document_id, vendor:vendor_id(name, city)',
    )
    .eq('id', id)
    .maybeSingle();

  if (!tx) notFound();

  const { data: lines } = await supabase
    .from('line_item')
    .select('id, line_no, raw_description, quantity, unit, unit_price, net_amount, discount_amount, category:category_id(name, color)')
    .eq('transaction_id', id)
    .order('line_no');

  // La foto sta in un bucket privato: si serve con un URL firmato a scadenza breve.
  let photoUrl: string | null = null;
  if (tx.document_id) {
    const { data: doc } = await supabase
      .from('document')
      .select('storage_path')
      .eq('id', tx.document_id)
      .maybeSingle();
    if (doc?.storage_path) {
      const { data: signed } = await supabase.storage
        .from('receipts')
        .createSignedUrl(doc.storage_path, 300);
      photoUrl = signed?.signedUrl ?? null;
    }
  }

  const vendor = Array.isArray(tx.vendor) ? tx.vendor[0] : tx.vendor;
  const totalCents = numericToCents(tx.total_amount);

  return (
    <>
      <Link
        href="/spese"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Spese
      </Link>

      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          {vendor?.name ?? 'Senza insegna'}
        </h1>
        <p className="text-sm text-fg-muted">
          {dateTime(tx.occurred_at)}
          {vendor?.city ? ` · ${vendor.city}` : ''}
        </p>
      </header>

      <Card className="mb-5 p-5">
        <p className="text-xs font-medium text-fg-muted">Totale</p>
        <p className="tabular text-4xl font-semibold tracking-tight text-fg">{euro(totalCents)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tx.payment_method ? <Badge>{tx.payment_method}</Badge> : null}
          {numericToCents(tx.discount_total) > 0 ? (
            <Badge tone="positive">
              {euro(numericToCents(tx.discount_total))} di sconto
            </Badge>
          ) : null}
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-fg">
          Righe <span className="text-fg-subtle">({lines?.length ?? 0})</span>
        </h2>

        <ul className="space-y-2">
          {(lines ?? []).map((line) => {
            const category = Array.isArray(line.category) ? line.category[0] : line.category;
            const unit = line.unit as Unit;
            return (
              <li key={line.id}>
                <Card className="flex items-start gap-3 p-3.5">
                  <span
                    aria-hidden
                    className="mt-1.5 size-2.5 shrink-0 rounded-full"
                    style={{ background: category?.color ?? 'var(--border-strong)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{line.raw_description}</p>
                    <p className="text-xs text-fg-muted">
                      {fmtQuantity(numericToNumber(line.quantity), unit)} ×{' '}
                      {fmtUnitPrice(numericToNumber(line.unit_price), unit)}
                      {category ? ` · ${category.name}` : ''}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-sm font-medium text-fg">
                    {euro(numericToCents(line.net_amount))}
                  </span>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {photoUrl ? (
        <section className="mt-6 space-y-2">
          <h2 className="flex items-center gap-1.5 px-1 text-sm font-semibold text-fg">
            <ImageIcon className="size-4" /> Scontrino originale
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Foto dello scontrino"
            className="w-full rounded-[var(--radius-card)] border border-border"
          />
        </section>
      ) : null}
    </>
  );
}
