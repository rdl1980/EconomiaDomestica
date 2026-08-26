/**
 * Risoluzione di insegne e prodotti a partire da un draft.
 *
 * Regola di prudenza: si accetta un match automatico solo quando è netto.
 * In tutti gli altri casi si producono *suggerimenti* e si lascia decidere
 * l'utente. Un prodotto agganciato al prodotto sbagliato inquina lo storico
 * prezzi in modo silenzioso, ed è molto peggio di una riga lasciata da
 * categorizzare, che almeno si vede.
 */

import { normalizeDescription, normalizeVendorName } from './normalize.js';
import { rankCandidates, similarityScore, type ScoredCandidate } from './similarity.js';

/** Soglia oltre la quale il match viene applicato senza chiedere conferma. */
export const AUTO_MATCH_THRESHOLD = 0.86;
/** Distanza minima dal secondo candidato: se due prodotti si somigliano, decide l'utente. */
export const AUTO_MATCH_MARGIN = 0.12;

export interface VendorCandidate {
  id: string;
  name: string;
  city?: string | null;
}

export interface ProductCandidate {
  id: string;
  name: string;
  brand?: string | null;
}

export interface AliasEntry {
  /** Chiave normalizzata, come salvata su product_alias.normalized. */
  normalized: string;
  productId: string;
  /** null = alias globale, valido su qualunque insegna. */
  vendorId: string | null;
}

export type MatchOutcome<T> =
  | { kind: 'exact'; item: T }
  | { kind: 'auto'; item: T; score: number }
  | { kind: 'suggest'; suggestions: ScoredCandidate<T>[] }
  | { kind: 'none' };

function decide<T>(ranked: ScoredCandidate<T>[]): MatchOutcome<T> {
  const best = ranked[0];
  if (!best) return { kind: 'none' };

  const runnerUp = ranked[1];
  const margin = runnerUp ? best.score - runnerUp.score : 1;
  if (best.score >= AUTO_MATCH_THRESHOLD && margin >= AUTO_MATCH_MARGIN) {
    return { kind: 'auto', item: best.item, score: best.score };
  }
  return { kind: 'suggest', suggestions: ranked };
}

/**
 * Aggancia l'insegna dello scontrino a un vendor già noto.
 * La città, quando disponibile su entrambi, fa da tie-break: due Esselunga in
 * città diverse sono due punti vendita diversi, e la distinzione conta per il
 * confronto prezzi.
 */
export function resolveVendor(
  rawName: string,
  candidates: readonly VendorCandidate[],
  city?: string | null,
): MatchOutcome<VendorCandidate> {
  const needle = normalizeVendorName(rawName);
  if (needle.length === 0) return { kind: 'none' };

  const exact = candidates.find((c) => normalizeVendorName(c.name) === needle);
  if (exact) {
    const sameCityRequired = city != null && exact.city != null;
    if (!sameCityRequired || normalizeDescription(exact.city ?? '') === normalizeDescription(city)) {
      return { kind: 'exact', item: exact };
    }
  }

  const normalizedCity = city != null ? normalizeDescription(city) : null;
  const ranked = candidates
    .map((item) => {
      let score = similarityScore(needle, normalizeVendorName(item.name));
      if (normalizedCity && item.city && normalizeDescription(item.city) === normalizedCity) {
        score = Math.min(1, score + 0.1);
      }
      return { item, score };
    })
    .filter((c) => c.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return decide(ranked);
}

/**
 * Aggancia una riga di scontrino a un prodotto.
 *
 * Ordine di precedenza:
 *   1. alias specifico dell'insegna  (il più affidabile: lo ha creato l'utente)
 *   2. alias globale
 *   3. similarità sul nome dei prodotti già a catalogo -> solo suggerimenti,
 *      salvo match molto netto
 */
export function resolveProduct(
  rawDescription: string,
  vendorId: string | null,
  aliases: readonly AliasEntry[],
  products: readonly ProductCandidate[],
): MatchOutcome<ProductCandidate> {
  const key = normalizeDescription(rawDescription);
  if (key.length === 0) return { kind: 'none' };

  const byId = new Map(products.map((p) => [p.id, p] as const));

  if (vendorId) {
    const scoped = aliases.find((a) => a.vendorId === vendorId && a.normalized === key);
    const product = scoped ? byId.get(scoped.productId) : undefined;
    if (product) return { kind: 'exact', item: product };
  }

  const global = aliases.find((a) => a.vendorId === null && a.normalized === key);
  const globalProduct = global ? byId.get(global.productId) : undefined;
  if (globalProduct) return { kind: 'exact', item: globalProduct };

  const ranked = rankCandidates(
    key,
    products,
    (p) => normalizeDescription([p.brand, p.name].filter(Boolean).join(' ')),
    { limit: 5, minScore: 0.35 },
  );

  return decide(ranked);
}

/** Chiave con cui salvare un nuovo alias dopo una correzione dell'utente. */
export function aliasKeyFor(rawDescription: string): string {
  return normalizeDescription(rawDescription);
}
