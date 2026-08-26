'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { PreparedReceipt, Unit } from '@ed/core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge, Field, Input } from '@/components/ui/primitives';
import { euro, quantity as fmtQuantity, unitPrice as fmtUnitPrice } from '@/lib/format';
import { confirmReceipt } from '@/lib/receipts/actions';
import { cn } from '@/lib/utils';

interface VendorOption {
  id: string;
  name: string;
  city: string | null;
}
interface CategoryOption {
  slug: string;
  name: string;
  color: string | null;
  parent: string | null;
}

interface LineState {
  lineNo: number;
  rawDescription: string;
  name: string;
  quantity: number;
  unit: Unit;
  unitPrice: number;
  discountAmount: number;
  netAmount: number;
  vatRate: number | null;
  categorySlug: string;
  productId: string | null;
  include: boolean;
  /** true se la riga era già riconosciuta: niente nuovo alias da imparare. */
  known: boolean;
  issues: string[];
}

const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'pcs', label: 'pezzi' },
  { value: 'kg', label: 'kg' },
  { value: 'l', label: 'litri' },
];

/** ISO -> valore per <input type="datetime-local"> in ora locale. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ReviewForm({
  documentId,
  prepared,
  vendorOptions,
  categoryOptions,
}: {
  documentId: string;
  prepared: PreparedReceipt;
  vendorOptions: VendorOption[];
  categoryOptions: CategoryOption[];
}) {
  const [vendorName, setVendorName] = useState(prepared.draft.vendor.name);
  const [occurredAt, setOccurredAt] = useState(toLocalInput(prepared.draft.purchased_at));
  const [declaredTotal, setDeclaredTotal] = useState(prepared.draft.total_amount);
  const [expanded, setExpanded] = useState<number | null>(
    prepared.lines.find((l) => l.issues.length > 0)?.lineNo ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [lines, setLines] = useState<LineState[]>(() =>
    prepared.lines.map((l) => ({
      lineNo: l.lineNo,
      rawDescription: l.rawDescription,
      name: l.suggestedName,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      discountAmount: l.discountCents / 100,
      netAmount: l.netCents / 100,
      vatRate: l.vatRate,
      categorySlug: l.category.slug,
      productId: l.productId,
      include: true,
      known: l.productId !== null,
      issues: l.issues.map((i) => i.message),
    })),
  );

  /** L'insegna si aggancia per nome esatto: se non combacia, ne creiamo una nuova. */
  const vendorId = useMemo(() => {
    const match = vendorOptions.find(
      (v) => v.name.trim().toLowerCase() === vendorName.trim().toLowerCase(),
    );
    return match?.id ?? null;
  }, [vendorName, vendorOptions]);

  const includedLines = lines.filter((l) => l.include);
  const computedTotal = round2(includedLines.reduce((sum, l) => sum + l.netAmount, 0));
  const difference = round2(computedTotal - declaredTotal);
  const balanced = Math.abs(difference) <= Math.max(0.05, includedLines.length * 0.01);
  const toLearn = includedLines.filter((l) => !l.known).length;

  function updateLine(lineNo: number, patch: Partial<LineState>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.lineNo !== lineNo) return line;
        const next = { ...line, ...patch };
        // Se cambiano quantità, prezzo o sconto, l'importo si ricalcola: lasciarlo
        // fermo produrrebbe righe che non tornano più con i propri numeri.
        if (
          patch.quantity !== undefined ||
          patch.unitPrice !== undefined ||
          patch.discountAmount !== undefined
        ) {
          next.netAmount = round2(next.quantity * next.unitPrice - next.discountAmount);
        }
        return next;
      }),
    );
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmReceipt({
        documentId,
        vendor: {
          id: vendorId,
          name: vendorName.trim(),
          city: prepared.draft.vendor.city,
          chain: prepared.draft.vendor.chain,
        },
        occurredAt: new Date(occurredAt).toISOString(),
        paymentMethod: prepared.draft.payment_method,
        totalAmount: declaredTotal,
        discountTotal: prepared.totals.globalDiscount / 100,
        notes: null,
        lines: lines.map((l) => ({
          lineNo: l.lineNo,
          rawDescription: l.rawDescription,
          name: l.name.trim(),
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
          discountAmount: l.discountAmount,
          netAmount: l.netAmount,
          vatRate: l.vatRate,
          categorySlug: l.categorySlug,
          productId: l.productId,
          include: l.include,
        })),
      });
      // In caso di successo la server action reindirizza e questo non viene raggiunto.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-5 pb-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Rivedi e conferma</h1>
        <p className="text-sm text-fg-muted">
          Niente entra nelle statistiche finché non confermi.
        </p>
      </header>

      {/* --------------------------------------------------------------- testata */}
      <Card className="space-y-4 p-4">
        <Field
          label="Negozio"
          hint={vendorId ? 'Insegna già conosciuta.' : 'Nuova insegna: la creiamo al salvataggio.'}
        >
          <Input
            list="vendor-options"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="Esselunga"
          />
          <datalist id="vendor-options">
            {vendorOptions.map((v) => (
              <option key={v.id} value={v.name}>
                {v.city ?? ''}
              </option>
            ))}
          </datalist>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data e ora">
            <Input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </Field>
          <Field label="Totale scontrino">
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={declaredTotal}
              onChange={(e) => setDeclaredTotal(Number(e.target.value))}
              className="tabular"
            />
          </Field>
        </div>
      </Card>

      {/* ----------------------------------------------------------- quadratura */}
      {!balanced ? (
        <div className="flex gap-3 rounded-[var(--radius-card)] border border-warning-soft bg-warning-soft p-4">
          <AlertTriangle className="size-5 shrink-0 text-warning" />
          <div className="space-y-1 text-xs leading-relaxed">
            <p className="font-medium text-fg">Lo scontrino non quadra</p>
            <p className="text-fg-muted">
              La somma delle righe fa{' '}
              <span className="tabular font-medium text-fg">{euro(computedTotal * 100)}</span>, il
              totale dichiarato è{' '}
              <span className="tabular font-medium text-fg">{euro(declaredTotal * 100)}</span>:{' '}
              scarto di{' '}
              <span className="tabular font-medium text-fg">{euro(Math.abs(difference) * 100)}</span>.
              Le righe segnalate sotto sono le più probabili responsabili.
            </p>
          </div>
        </div>
      ) : null}

      {/* --------------------------------------------------------------- righe */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-fg">
            Righe <span className="text-fg-subtle">({includedLines.length})</span>
          </h2>
          {prepared.recognitionRate > 0 ? (
            <span className="text-xs text-fg-muted">
              {Math.round(prepared.recognitionRate * 100)}% già riconosciuto
            </span>
          ) : null}
        </div>

        {lines.map((line) => {
          const isOpen = expanded === line.lineNo;
          const hasIssues = line.issues.length > 0;

          return (
            <Card
              key={line.lineNo}
              className={cn(
                'overflow-hidden transition-colors',
                !line.include && 'opacity-50',
                hasIssues && 'border-warning',
              )}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : line.lineNo)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium text-fg">{line.name}</p>
                  <p className="truncate font-mono text-[11px] text-fg-subtle">
                    {line.rawDescription}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {fmtQuantity(line.quantity, line.unit)} ×{' '}
                    {fmtUnitPrice(line.unitPrice, line.unit)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular text-sm font-semibold text-fg">
                    {euro(Math.round(line.netAmount * 100))}
                  </span>
                  {hasIssues ? (
                    <Badge tone="warning">da verificare</Badge>
                  ) : line.known ? (
                    <Badge tone="positive">noto</Badge>
                  ) : (
                    <Badge tone="primary">nuovo</Badge>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-fg-subtle transition-transform',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>

              {isOpen ? (
                <div className="space-y-4 border-t border-border bg-surface-2/50 p-4">
                  {hasIssues ? (
                    <ul className="space-y-1">
                      {line.issues.map((issue) => (
                        <li key={issue} className="text-xs leading-relaxed text-warning">
                          {issue}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <Field label="Nome del prodotto" hint="È il nome che vedrai nelle statistiche.">
                    <Input
                      value={line.name}
                      onChange={(e) =>
                        updateLine(line.lineNo, { name: e.target.value, productId: null })
                      }
                    />
                  </Field>

                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Quantità">
                      <Input
                        type="number"
                        step="0.001"
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.lineNo, { quantity: Number(e.target.value) })
                        }
                        className="tabular"
                      />
                    </Field>
                    <Field label="Unità">
                      <select
                        value={line.unit}
                        onChange={(e) =>
                          updateLine(line.lineNo, { unit: e.target.value as Unit })
                        }
                        className="h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-2 text-sm text-fg"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Prezzo unitario">
                      <Input
                        type="number"
                        step="0.0001"
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(e) =>
                          updateLine(line.lineNo, { unitPrice: Number(e.target.value) })
                        }
                        className="tabular"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Sconto">
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={line.discountAmount}
                        onChange={(e) =>
                          updateLine(line.lineNo, { discountAmount: Number(e.target.value) })
                        }
                        className="tabular"
                      />
                    </Field>
                    <Field label="Categoria">
                      <select
                        value={line.categorySlug}
                        onChange={(e) =>
                          updateLine(line.lineNo, { categorySlug: e.target.value })
                        }
                        className="h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-2 text-sm text-fg"
                      >
                        {categoryOptions.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.parent ? `— ${c.name}` : c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="tabular text-sm text-fg-muted">
                      Totale riga{' '}
                      <span className="font-semibold text-fg">
                        {euro(Math.round(line.netAmount * 100))}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant={line.include ? 'ghost' : 'soft'}
                      size="sm"
                      onClick={() => updateLine(line.lineNo, { include: !line.include })}
                    >
                      <Trash2 />
                      {line.include ? 'Escludi riga' : 'Reintegra'}
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>
          );
        })}
      </section>

      {/* ------------------------------------------------------------ conferma */}
      {toLearn > 0 ? (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] bg-primary-soft p-4">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-fg-muted">
            Confermando, l&apos;app impara{' '}
            <span className="font-medium text-fg">
              {toLearn} {toLearn === 1 ? 'nuova voce' : 'nuove voci'}
            </span>{' '}
            per questo negozio. La prossima volta le riconosce da sola.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-[var(--radius-card)] bg-negative-soft p-4 text-xs text-negative">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-24 space-y-2">
        <Button size="lg" full onClick={handleConfirm} disabled={pending || includedLines.length === 0}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
          Conferma {euro(Math.round(computedTotal * 100))}
        </Button>
      </div>
    </div>
  );
}
