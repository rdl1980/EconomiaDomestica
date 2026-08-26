/**
 * Palette categoriale per le serie che non hanno un colore proprio (le insegne).
 *
 * È lo stesso insieme usato dalle categorie radice, e va usato **in quest'ordine**:
 * è stato validato come insieme per separazione in deuteranopia, protanopia e
 * tritanopia, soglia di croma e contrasto sulla superficie, in tema chiaro e in
 * tema scuro. Riordinarlo o sostituire una tinta invalida le distanze fra le
 * altre.
 *
 * Nessun colore viene generato oltre l'ottavo: le serie in eccesso si fondono in
 * "Altro". Una palette categoriale ha un numero finito di tinte distinguibili, e
 * girare in tondo sulle stesse produce due serie identiche nello stesso grafico.
 */
export const SERIES_COLORS = [
  '#16a34a',
  '#6366f1',
  '#ea580c',
  '#0891b2',
  '#db2777',
  '#b45309',
  '#9333ea',
  '#dc2626',
] as const;

export const MAX_SERIES = SERIES_COLORS.length;

/** Colore stabile per una serie, assegnato per posizione nell'elenco ordinato. */
export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length]!;
}
