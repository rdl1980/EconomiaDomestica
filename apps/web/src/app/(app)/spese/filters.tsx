'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { RANGE_OPTIONS } from '@/lib/data/filters';
import { cn } from '@/lib/utils';

/**
 * Barra filtri dell'elenco spese.
 *
 * Scrive nella query string invece che in uno stato locale: la vista filtrata
 * diventa un link condivisibile e il tasto indietro funziona come ci si aspetta.
 * La ricerca è ritardata di 300 ms perché ogni pressione altrimenti sarebbe una
 * navigazione.
 */

export interface FilterOption {
  value: string;
  label: string;
}

export function ExpenseFilters({
  vendors,
  categories,
}: {
  vendors: FilterOption[];
  categories: FilterOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  const range = searchParams.get('periodo') ?? 'mese';
  const vendorId = searchParams.get('negozio') ?? '';
  const categorySlug = searchParams.get('categoria') ?? '';
  const activeCount = [
    range !== 'mese',
    vendorId !== '',
    categorySlug !== '',
    (searchParams.get('q') ?? '') !== '',
  ].filter(Boolean).length;

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    const search = next.toString();
    startTransition(() => router.replace(search ? `/spese?${search}` : '/spese'));
  }

  // Debounce della ricerca: la navigazione parte quando si smette di scrivere.
  useEffect(() => {
    const currentQ = searchParams.get('q') ?? '';
    if (query === currentQ) return;
    const timer = setTimeout(() => setParam('q', query || null), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="mb-4 space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca negozio o prodotto"
            className="pl-9"
            type="search"
            inputMode="search"
          />
        </div>
        <Button
          variant={activeCount > 0 ? 'soft' : 'secondary'}
          size="icon"
          aria-label="Filtri"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal />
        </Button>
      </div>

      {/* Il periodo resta sempre visibile: è il filtro che si cambia più spesso. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setParam('periodo', option.value === 'mese' ? null : option.value)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              range === option.value
                ? 'border-transparent bg-primary text-primary-fg'
                : 'border-border bg-surface text-fg-muted hover:border-border-strong',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {open ? (
        <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-fg-muted">Negozio</span>
            <select
              value={vendorId}
              onChange={(e) => setParam('negozio', e.target.value || null)}
              className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-2 text-sm text-fg"
            >
              <option value="">Tutti</option>
              {vendors.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-fg-muted">Categoria</span>
            <select
              value={categorySlug}
              onChange={(e) => setParam('categoria', e.target.value || null)}
              className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-2 text-sm text-fg"
            >
              <option value="">Tutte</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {activeCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="col-span-2"
              onClick={() => {
                setQuery('');
                startTransition(() => router.replace('/spese'));
              }}
            >
              <X /> Azzera i filtri
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
