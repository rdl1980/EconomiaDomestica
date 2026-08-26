/**
 * Misure di similarità testuale per il matching di insegne e prodotti.
 *
 * Restano nel dominio puro (e non delegate a pg_trgm) perché servono anche lato
 * client, durante la revisione, per proporre suggerimenti mentre si digita senza
 * un round-trip al database.
 */

/** Trigrammi di una stringa, con padding ai bordi come fa pg_trgm. */
export function trigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const result = new Set<string>();
  for (let i = 0; i < padded.length - 2; i += 1) {
    result.add(padded.slice(i, i + 3));
  }
  return result;
}

/** Coefficiente di Dice sui trigrammi: 0 = niente in comune, 1 = identiche. */
export function trigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return (2 * shared) / (ta.size + tb.size);
}

/** Quota di token di `needle` presenti in `haystack`. Premia i prefissi comuni. */
export function tokenOverlap(needle: string, haystack: string): number {
  const a = needle.split(' ').filter(Boolean);
  const b = new Set(haystack.split(' ').filter(Boolean));
  if (a.length === 0) return 0;
  let hits = 0;
  for (const token of a) if (b.has(token)) hits += 1;
  return hits / a.length;
}

/**
 * Punteggio combinato usato per i suggerimenti.
 * I trigrammi reggono gli errori di battitura, l'overlap di token evita che
 * stringhe con lettere simili ma parole diverse finiscano in cima.
 */
export function similarityScore(a: string, b: string): number {
  return 0.6 * trigramSimilarity(a, b) + 0.4 * tokenOverlap(a, b);
}

export interface ScoredCandidate<T> {
  item: T;
  score: number;
}

/** Ordina i candidati per similarità decrescente, scartando quelli sotto soglia. */
export function rankCandidates<T>(
  query: string,
  candidates: readonly T[],
  keyOf: (item: T) => string,
  { limit = 5, minScore = 0.3 }: { limit?: number; minScore?: number } = {},
): ScoredCandidate<T>[] {
  return candidates
    .map((item) => ({ item, score: similarityScore(query, keyOf(item)) }))
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
