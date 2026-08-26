/**
 * Aritmetica monetaria.
 *
 * Regola non negoziabile: gli importi si sommano e si confrontano in **centesimi
 * interi**, mai in euro come float. `0.1 + 0.2 !== 0.3` e su uno scontrino da
 * quaranta righe l'errore diventa visibile.
 *
 * I prezzi unitari sono l'eccezione: esistono tariffe come 0,0295 EUR/kWh, quindi
 * si conservano con 4 decimali. Vengono usati per moltiplicare, non per sommare.
 */

/** Importo in centesimi interi. */
export type Cents = number;

/** Tolleranza di riconciliazione: gli scontrini arrotondano, 2 centesimi di scarto per riga sono fisiologici. */
export const LINE_TOLERANCE_CENTS = 2;

/** Tolleranza sul totale dello scontrino: cresce con il numero di righe, perche' gli arrotondamenti si accumulano. */
export function totalToleranceCents(lineCount: number): Cents {
  return Math.max(5, Math.ceil(lineCount / 2));
}

/** Euro (float, come arriva da JSON) -> centesimi interi. */
export function toCents(eur: number): Cents {
  if (!Number.isFinite(eur)) throw new RangeError(`Importo non finito: ${eur}`);
  // Il +Number.EPSILON compensa i casi tipo 1.005 rappresentati come 1.00499999.
  return Math.round((eur + Math.sign(eur) * Number.EPSILON) * 100);
}

/** Centesimi interi -> euro con 2 decimali esatti. */
export function fromCents(cents: Cents): number {
  return Math.round(cents) / 100;
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** Arrotonda un prezzo unitario a 4 decimali (il massimo che il database conserva). */
export function roundUnitPrice(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`Prezzo unitario non finito: ${value}`);
  return Math.round(value * 10_000) / 10_000;
}

/** Arrotonda una quantita' a 3 decimali (grammi, millilitri). */
export function roundQuantity(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`Quantita' non finita: ${value}`);
  return Math.round(value * 1_000) / 1_000;
}

/**
 * quantita' x prezzo unitario -> importo in centesimi.
 * Il prodotto si calcola in euro e si arrotonda una volta sola, come fa la cassa.
 */
export function lineAmountCents(quantity: number, unitPrice: number): Cents {
  return toCents(quantity * unitPrice);
}

export function withinTolerance(a: Cents, b: Cents, tolerance: Cents): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** Formattazione per la UI. Locale italiano, valuta configurabile. */
export function formatCents(cents: Cents, currency = 'EUR', locale = 'it-IT'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromCents(cents));
}

/**
 * Formattazione di un prezzo unitario: mostra i decimali che servono davvero.
 * 3,90 EUR/kg resta a 2 decimali, 0,0295 EUR/kWh non viene schiacciato a 0,03.
 */
export function formatUnitPrice(value: number, currency = 'EUR', locale = 'it-IT'): string {
  const decimals = Math.abs(value) < 1 && value !== 0 ? 4 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Variazione percentuale fra due periodi.
 * Ritorna null quando il confronto non ha senso (base a zero): meglio "nessun dato"
 * di un +Infinity mostrato in dashboard.
 */
export function percentChange(current: Cents, previous: Cents): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
