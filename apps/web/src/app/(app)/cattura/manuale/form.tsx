'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import type { ReceiptDraft, Unit } from '@ed/core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/primitives';
import { euro } from '@/lib/format';
import { saveManualDraft } from '@/lib/receipts/actions';

interface Row {
  key: number;
  description: string;
  quantity: string;
  unit: Unit;
  unitPrice: string;
}

function emptyRow(key: number): Row {
  return { key, description: '', quantity: '1', unit: 'pcs', unitPrice: '' };
}

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ManualForm({ vendors }: { vendors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [vendorName, setVendorName] = useState('');
  const [occurredAt, setOccurredAt] = useState(nowLocal());
  const [rows, setRows] = useState<Row[]>([emptyRow(1), emptyRow(2), emptyRow(3)]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filled = rows.filter((r) => r.description.trim() && Number(r.unitPrice) > 0);
  const total = filled.reduce(
    (sum, r) => sum + Math.round(Number(r.quantity) * Number(r.unitPrice) * 100),
    0,
  );

  function update(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function handleSubmit() {
    setError(null);
    if (!vendorName.trim()) return setError('Manca il negozio.');
    if (filled.length === 0) return setError('Aggiungi almeno una riga con descrizione e prezzo.');

    const draft: ReceiptDraft = {
      schema_version: '1.0',
      source: 'manual',
      vendor: {
        name: vendorName.trim(),
        chain: null,
        address: null,
        city: null,
        vat_number: null,
      },
      purchased_at: new Date(occurredAt).toISOString(),
      currency: 'EUR',
      payment_method: null,
      total_amount: total / 100,
      discount_total: null,
      loyalty: null,
      lines: filled.map((r, index) => {
        const q = Number(r.quantity);
        const p = Number(r.unitPrice);
        const net = Math.round(q * p * 100) / 100;
        return {
          line_no: index + 1,
          raw_description: r.description.trim(),
          quantity: q,
          unit: r.unit,
          unit_price: p,
          gross_amount: net,
          discount_amount: null,
          net_amount: net,
          vat_rate: null,
          category_hint: null,
          notes: null,
        };
      }),
      confidence: 1,
      warnings: [],
    };

    startTransition(async () => {
      const result = await saveManualDraft(draft);
      if ('error' in result) setError(result.error);
      else router.push(`/revisione/${result.id}`);
    });
  }

  return (
    <div className="space-y-5">
      <Card className="grid grid-cols-1 gap-4 p-4">
        <Field label="Negozio">
          <Input
            list="manual-vendors"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="Esselunga"
          />
          <datalist id="manual-vendors">
            {vendors.map((v) => (
              <option key={v.id} value={v.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Data e ora">
          <Input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </Field>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Righe</h2>
        {rows.map((row) => (
          <Card key={row.key} className="space-y-3 p-3.5">
            <div className="flex items-center gap-2">
              <Input
                value={row.description}
                onChange={(e) => update(row.key, { description: e.target.value })}
                placeholder="Descrizione, come sullo scontrino"
              />
              {rows.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Togli riga"
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                >
                  <X />
                </Button>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                step="0.001"
                inputMode="decimal"
                value={row.quantity}
                onChange={(e) => update(row.key, { quantity: e.target.value })}
                aria-label="Quantità"
                className="tabular"
              />
              <select
                value={row.unit}
                onChange={(e) => update(row.key, { unit: e.target.value as Unit })}
                aria-label="Unità"
                className="h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-2 text-sm text-fg"
              >
                <option value="pcs">pezzi</option>
                <option value="kg">kg</option>
                <option value="l">litri</option>
              </select>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={row.unitPrice}
                onChange={(e) => update(row.key, { unitPrice: e.target.value })}
                placeholder="€/unità"
                aria-label="Prezzo unitario"
                className="tabular"
              />
            </div>
          </Card>
        ))}

        <Button
          type="button"
          variant="secondary"
          full
          onClick={() => setRows((prev) => [...prev, emptyRow(Date.now())])}
        >
          <Plus /> Aggiungi riga
        </Button>
      </section>

      {error ? (
        <p className="rounded-[var(--radius-card)] bg-negative-soft p-4 text-xs text-negative">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-24">
        <Button size="lg" full onClick={handleSubmit} disabled={pending || filled.length === 0}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Continua · {euro(total)}
        </Button>
      </div>
    </div>
  );
}
