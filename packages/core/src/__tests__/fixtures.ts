import type { ReceiptDraft } from '../receipt/draft.js';

/**
 * Scontrino realistico: prodotti a pezzo, prodotti a peso, uno sconto riga.
 * I numeri quadrano esattamente, così i test sulle anomalie partono da una base
 * pulita e ogni scostamento è introdotto di proposito.
 *
 * 2 × 1,29 = 2,58
 * 0,482 × 3,90 = 1,8798 -> 1,88
 * 0,310 × 26,90 = 8,339 -> 8,34, meno 0,36 di sconto = 7,98
 * totale = 12,44
 */
export const esselungaDraft: ReceiptDraft = {
  schema_version: '1.0',
  source: 'external',
  vendor: {
    name: 'ESSELUNGA',
    chain: 'Esselunga',
    address: 'Via Roma 12',
    city: 'Milano',
    vat_number: null,
  },
  purchased_at: '2026-08-20T18:32:00+02:00',
  currency: 'EUR',
  payment_method: 'carta',
  total_amount: 12.44,
  discount_total: null,
  loyalty: { card_last4: '4417', points_earned: 12, points_redeemed: null },
  lines: [
    {
      line_no: 1,
      raw_description: 'PMD LATTE PS 1L',
      quantity: 2,
      unit: 'pcs',
      unit_price: 1.29,
      gross_amount: 2.58,
      discount_amount: null,
      net_amount: 2.58,
      vat_rate: 4,
      category_hint: 'latticini',
      notes: null,
    },
    {
      line_no: 2,
      raw_description: 'POMOD.CILIEG.',
      quantity: 0.482,
      unit: 'kg',
      unit_price: 3.9,
      gross_amount: 1.88,
      discount_amount: null,
      net_amount: 1.88,
      vat_rate: 4,
      category_hint: 'ortofrutta',
      notes: null,
    },
    {
      line_no: 3,
      raw_description: 'PARMIGIANO REGG.24M',
      quantity: 0.31,
      unit: 'kg',
      unit_price: 26.9,
      gross_amount: 8.34,
      discount_amount: 0.36,
      net_amount: 7.98,
      vat_rate: 4,
      category_hint: 'latticini',
      notes: null,
    },
  ],
  confidence: 0.94,
  warnings: [],
};

export function draftWith(overrides: Partial<ReceiptDraft>): ReceiptDraft {
  return { ...esselungaDraft, ...overrides };
}
