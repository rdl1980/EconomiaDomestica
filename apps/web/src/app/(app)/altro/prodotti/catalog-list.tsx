'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, ChevronDown, Loader2, Merge, Search, Trash2 } from 'lucide-react';
import { normalizeDescription, similarityScore, type Unit } from '@ed/core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge, Field, Input } from '@/components/ui/primitives';
import { euro, relativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { deleteAlias, mergeProducts, updateProduct } from './actions';

export interface CatalogEntry {
  productId: string;
  name: string;
  brand: string | null;
  defaultUnit: Unit;
  categorySlug: string;
  categoryName: string;
  categoryColor: string;
  packageSize: number | null;
  packageUnit: Unit | null;
  lineCount: number;
  spendCents: number;
  lastBought: string | null;
  aliases: { id: string; normalized: string; vendor: string | null }[];
}

/** Soglia oltre la quale due nomi sono abbastanza simili da valere una segnalazione. */
const DUPLICATE_THRESHOLD = 0.62;

export function CatalogList({
  entries,
  categories,
}: {
  entries: CatalogEntry[];
  categories: { slug: string; name: string }[];
}) {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  /**
   * Doppioni probabili.
   *
   * Il meccanismo di apprendimento crea un prodotto per ogni riga non
   * riconosciuta, quindi i doppioni sono fisiologici, non un bug. Segnalarli
   * qui è ciò che tiene pulito lo storico prezzi: due voci per lo stesso latte
   * significano due curve dei prezzi entrambe incomplete.
   */
  const duplicates = useMemo(() => {
    const map = new Map<string, CatalogEntry[]>();
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const a = entries[i]!;
        const b = entries[j]!;
        const score = similarityScore(
          normalizeDescription(a.name),
          normalizeDescription(b.name),
        );
        if (score >= DUPLICATE_THRESHOLD) {
          map.set(a.productId, [...(map.get(a.productId) ?? []), b]);
          map.set(b.productId, [...(map.get(b.productId) ?? []), a]);
        }
      }
    }
    return map;
  }, [entries]);

  const filtered = useMemo(() => {
    const needle = normalizeDescription(search);
    if (!needle) return entries;
    return entries.filter(
      (e) =>
        normalizeDescription(e.name).includes(needle) ||
        e.aliases.some((a) => a.normalized.includes(needle)),
    );
  }, [entries, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca un prodotto o un'abbreviazione"
          className="pl-9"
          type="search"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-subtle">Nessun prodotto trovato.</p>
      ) : null}

      <ul className="space-y-2">
        {filtered.map((entry) => (
          <li key={entry.productId}>
            <ProductRow
              entry={entry}
              categories={categories}
              similar={duplicates.get(entry.productId) ?? []}
              open={openId === entry.productId}
              onToggle={() => setOpenId(openId === entry.productId ? null : entry.productId)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductRow({
  entry,
  categories,
  similar,
  open,
  onToggle,
}: {
  entry: CatalogEntry;
  categories: { slug: string; name: string }[];
  similar: CatalogEntry[];
  open: boolean;
  onToggle: () => void;
}) {
  const [name, setName] = useState(entry.name);
  const [brand, setBrand] = useState(entry.brand ?? '');
  const [categorySlug, setCategorySlug] = useState(entry.categorySlug);
  const [defaultUnit, setDefaultUnit] = useState<Unit>(entry.defaultUnit);
  const [packageSize, setPackageSize] = useState(entry.packageSize?.toString() ?? '');
  const [packageUnit, setPackageUnit] = useState<Unit | ''>(entry.packageUnit ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const size = packageSize.trim() === '' ? null : Number(packageSize);
      const result = await updateProduct({
        productId: entry.productId,
        name: name.trim(),
        brand: brand.trim() === '' ? null : brand.trim(),
        categorySlug,
        defaultUnit,
        packageSize: size !== null && Number.isFinite(size) && size > 0 ? size : null,
        packageUnit: packageUnit === '' ? null : packageUnit,
      });
      setMessage(result.error ?? 'Salvato.');
    });
  }

  function handleMerge(targetId: string, targetName: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await mergeProducts(entry.productId, targetId);
      setMessage(result.error ?? `Unito a “${targetName}”.`);
    });
  }

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: entry.categoryColor }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{entry.name}</p>
          <p className="truncate text-xs text-fg-muted">
            {entry.categoryName} · {entry.aliases.length}{' '}
            {entry.aliases.length === 1 ? 'alias' : 'alias'} · {entry.lineCount}×
            {entry.lastBought ? ` · ${relativeDay(entry.lastBought)}` : ''}
          </p>
        </div>
        {similar.length > 0 ? <Badge tone="warning">doppione?</Badge> : null}
        <span className="tabular shrink-0 text-sm font-medium text-fg">
          {euro(entry.spendCents)}
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-fg-subtle transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border bg-surface-2/50 p-4">
          <Field label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Marca">
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="—" />
            </Field>
            <Field label="Categoria">
              <select
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                className="h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-2 text-sm text-fg"
              >
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Unità">
              <select
                value={defaultUnit}
                onChange={(e) => setDefaultUnit(e.target.value as Unit)}
                className="h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-2 text-sm text-fg"
              >
                <option value="pcs">pezzi</option>
                <option value="kg">kg</option>
                <option value="l">litri</option>
              </select>
            </Field>
            <Field label="Pezzatura">
              <Input
                type="number"
                step="0.001"
                inputMode="decimal"
                value={packageSize}
                onChange={(e) => setPackageSize(e.target.value)}
                placeholder="0,5"
                className="tabular"
              />
            </Field>
            <Field label="Unità pezz.">
              <select
                value={packageUnit}
                onChange={(e) => setPackageUnit(e.target.value as Unit | '')}
                className="h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-2 text-sm text-fg"
              >
                <option value="">—</option>
                <option value="kg">kg</option>
                <option value="l">litri</option>
              </select>
            </Field>
          </div>

          <p className="text-xs leading-relaxed text-fg-subtle">
            La pezzatura serve a confrontare i prezzi: senza, una confezione da 500 g e una da 1 kg
            restano due prezzi al pezzo che non si possono paragonare.
          </p>

          {/* -------------------------------------------------------------- alias */}
          {entry.aliases.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-fg-muted">
                Come appare sugli scontrini
              </p>
              <ul className="space-y-1">
                {entry.aliases.map((alias) => (
                  <li
                    key={alias.id}
                    className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5"
                  >
                    <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-fg-muted">
                      {alias.normalized}
                    </code>
                    {alias.vendor ? (
                      <span className="shrink-0 text-[11px] text-fg-subtle">{alias.vendor}</span>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Dimentica questo alias"
                      className="shrink-0 text-fg-subtle hover:text-negative"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await deleteAlias(alias.id);
                          setMessage(result.error ?? 'Alias rimosso.');
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* ----------------------------------------------------------- doppioni */}
          {similar.length > 0 ? (
            <div className="space-y-2 rounded-xl bg-warning-soft p-3">
              <p className="text-xs leading-relaxed text-fg-muted">
                Potrebbe essere lo stesso prodotto di{' '}
                {similar.length === 1 ? 'questa voce' : 'queste voci'}. Unendoli, righe, alias e
                storico prezzi confluiscono in uno solo.
              </p>
              <ul className="space-y-1.5">
                {similar.slice(0, 3).map((other) => (
                  <li key={other.productId} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-fg">{other.name}</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={() => handleMerge(other.productId, other.name)}
                    >
                      <Merge /> Unisci
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleSave} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />} Salva
            </Button>
            {message ? <span className="text-xs text-fg-muted">{message}</span> : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
