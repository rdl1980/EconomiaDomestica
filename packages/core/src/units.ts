/**
 * Unita' di misura e normalizzazione dei prezzi.
 *
 * Il problema che questo modulo risolve: "3 confezioni da 500 g a 2,49 EUR" e
 * "1,4 kg di sfuso a 3,90 EUR/kg" non sono confrontabili finche' non si riducono
 * alla stessa base. Senza questa normalizzazione il confronto prezzi fra
 * supermercati - cioe' il motivo per cui esiste l'app - non funziona.
 */

import { roundQuantity, roundUnitPrice } from './money';

export const UNITS = ['pcs', 'kg', 'l'] as const;
export type Unit = (typeof UNITS)[number];

export function isUnit(value: unknown): value is Unit {
  return typeof value === 'string' && (UNITS as readonly string[]).includes(value);
}

export const UNIT_LABEL: Record<Unit, string> = {
  pcs: 'pz',
  kg: 'kg',
  l: 'L',
};

/** Etichetta del prezzo normalizzato: "EUR/kg", "EUR/L", "EUR/pz". */
export function unitPriceLabel(unit: Unit): string {
  return `€/${UNIT_LABEL[unit]}`;
}

/**
 * Informazioni di pezzatura di un prodotto, quando note.
 * Servono a convertire un prezzo "al pezzo" in un prezzo al kg o al litro.
 */
export interface PackageInfo {
  /** Contenuto di una confezione, es. 0.5 per una busta da 500 g. */
  size: number;
  /** Unita' del contenuto. */
  unit: Unit;
}

export interface NormalizedPrice {
  unit: Unit;
  /** Prezzo per unita' normalizzata, 4 decimali. */
  unitPrice: number;
  /** Quantita' complessiva espressa nell'unita' normalizzata. */
  quantity: number;
  /**
   * false quando non e' stato possibile convertire al kg/L perche' manca la
   * pezzatura del prodotto: il prezzo resta al pezzo. La dashboard deve saperlo,
   * altrimenti confronta mele con pere senza dirlo.
   */
  isComparableByWeight: boolean;
}

/**
 * Riduce una riga di scontrino a un prezzo confrontabile.
 *
 * - unita' kg o L: gia' normalizzate, si prendono cosi' come sono
 * - unita' pcs con pezzatura nota: si converte in EUR/kg o EUR/L
 * - unita' pcs senza pezzatura: resta EUR/pz, ma marcata come non confrontabile
 */
export function normalizePrice(
  quantity: number,
  unit: Unit,
  unitPrice: number,
  pkg?: PackageInfo | null,
): NormalizedPrice {
  if (unit === 'kg' || unit === 'l') {
    return {
      unit,
      unitPrice: roundUnitPrice(unitPrice),
      quantity: roundQuantity(quantity),
      isComparableByWeight: true,
    };
  }

  // unit === 'pcs'
  if (pkg && pkg.size > 0 && (pkg.unit === 'kg' || pkg.unit === 'l')) {
    return {
      unit: pkg.unit,
      unitPrice: roundUnitPrice(unitPrice / pkg.size),
      quantity: roundQuantity(quantity * pkg.size),
      isComparableByWeight: true,
    };
  }

  return {
    unit: 'pcs',
    unitPrice: roundUnitPrice(unitPrice),
    quantity: roundQuantity(quantity),
    isComparableByWeight: false,
  };
}

/** Conversioni verso l'unita' base, per interpretare pezzature scritte in g o ml. */
const TO_BASE: Record<string, { factor: number; unit: Unit }> = {
  g: { factor: 0.001, unit: 'kg' },
  gr: { factor: 0.001, unit: 'kg' },
  grammi: { factor: 0.001, unit: 'kg' },
  kg: { factor: 1, unit: 'kg' },
  hg: { factor: 0.1, unit: 'kg' },
  ml: { factor: 0.001, unit: 'l' },
  cl: { factor: 0.01, unit: 'l' },
  l: { factor: 1, unit: 'l' },
  lt: { factor: 1, unit: 'l' },
  litri: { factor: 1, unit: 'l' },
};

/**
 * Estrae la pezzatura dal nome di un prodotto o dalla descrizione di scontrino.
 * Riconosce le forme comuni sugli scontrini italiani:
 *   "LATTE PS 1L", "PASTA 500 GR", "YOGURT 4x125g", "ACQUA 6X1,5 LT"
 *
 * Ritorna null quando non trova nulla di affidabile: un null onesto e' meglio di
 * una pezzatura inventata, che falserebbe tutti i confronti di prezzo.
 */
export function parsePackageSize(text: string): PackageInfo | null {
  const haystack = text.toLowerCase().replace(/,/g, '.');

  // Forma multipla: "4x125g", "6 x 1.5 lt"
  const multi = haystack.match(
    /(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(g|gr|grammi|kg|hg|ml|cl|l|lt|litri)\b/,
  );
  if (multi) {
    const count = Number(multi[1]);
    const each = Number(multi[2]);
    const conv = TO_BASE[multi[3] as string];
    if (conv && count > 0 && each > 0) {
      return { size: roundQuantity(count * each * conv.factor), unit: conv.unit };
    }
  }

  // Forma semplice: "500 gr", "1l", "1.5 lt"
  const single = haystack.match(
    /(\d+(?:\.\d+)?)\s*(g|gr|grammi|kg|hg|ml|cl|l|lt|litri)\b/,
  );
  if (single) {
    const value = Number(single[1]);
    const conv = TO_BASE[single[2] as string];
    if (conv && value > 0) {
      const size = roundQuantity(value * conv.factor);
      // Scarto le pezzature assurde: un "prodotto da 200 kg" e' quasi sempre un
      // numero letto male, non una confezione.
      if (size > 0 && size <= 100) return { size, unit: conv.unit };
    }
  }

  return null;
}
