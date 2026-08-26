/**
 * ReceiptDraft: il contratto canonico di uno scontrino.
 *
 * E' il confine dell'architettura di ingestion. Vision LLM, import di JSON
 * prodotto esternamente e inserimento manuale producono tutti questo oggetto;
 * da qui in poi la pipeline e' identica e non sa da dove arrivi il dato.
 *
 * Deve restare allineato a docs/schema/receipt-draft.schema.json.
 *
 * Il JSON esterno e' input non fidato: la validazione e' volutamente severa
 * (`strict()`), cosi' un campo scritto male fallisce subito invece di sparire
 * in silenzio.
 */

import { z } from 'zod';
import { UNITS } from '../units.js';

export const SCHEMA_VERSION = '1.0' as const;

export const DRAFT_SOURCES = ['vision', 'external', 'manual'] as const;
export type DraftSource = (typeof DRAFT_SOURCES)[number];

export const PAYMENT_METHODS = [
  'contanti',
  'carta',
  'bancomat',
  'buoni_pasto',
  'app',
  'altro',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const nullableString = z.string().trim().min(1).nullable().optional().default(null);

export const vendorDraftSchema = z
  .object({
    name: z.string().trim().min(1, "Il nome del negozio è obbligatorio"),
    chain: nullableString,
    address: nullableString,
    city: nullableString,
    vat_number: nullableString,
  })
  .strict();

export const receiptLineDraftSchema = z
  .object({
    line_no: z.int().min(1),
    raw_description: z
      .string()
      .trim()
      .min(1, "La descrizione della riga è obbligatoria")
      .max(300),
    quantity: z.number().positive("La quantità deve essere maggiore di zero"),
    unit: z.enum(UNITS),
    unit_price: z.number().min(0),
    gross_amount: z.number().nullable().optional().default(null),
    discount_amount: z.number().min(0).nullable().optional().default(null),
    net_amount: z.number(),
    vat_rate: z.number().min(0).max(100).nullable().optional().default(null),
    category_hint: nullableString,
    notes: nullableString,
  })
  .strict();

export const loyaltyDraftSchema = z
  .object({
    card_last4: nullableString,
    points_earned: z.number().nullable().optional().default(null),
    points_redeemed: z.number().nullable().optional().default(null),
  })
  .strict();

export const receiptDraftSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    source: z.enum(DRAFT_SOURCES),
    vendor: vendorDraftSchema,
    purchased_at: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), 'Data di acquisto non interpretabile'),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'Valuta in formato ISO 4217, es. EUR')
      .default('EUR'),
    payment_method: z.enum(PAYMENT_METHODS).nullable().optional().default(null),
    total_amount: z.number(),
    discount_total: z.number().min(0).nullable().optional().default(null),
    loyalty: loyaltyDraftSchema.nullable().optional().default(null),
    lines: z.array(receiptLineDraftSchema).min(1, 'Serve almeno una riga'),
    confidence: z.number().min(0).max(1).nullable().optional().default(null),
    warnings: z.array(z.string()).optional().default([]),
  })
  .strict();

export type VendorDraft = z.infer<typeof vendorDraftSchema>;
export type ReceiptLineDraft = z.infer<typeof receiptLineDraftSchema>;
export type ReceiptDraft = z.infer<typeof receiptDraftSchema>;

export interface ParseFailure {
  ok: false;
  /** Errori leggibili, gia' pronti per essere mostrati: "lines[3].quantity: ...". */
  errors: string[];
}

export interface ParseSuccess {
  ok: true;
  draft: ReceiptDraft;
}

export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Punto di ingresso unico per qualunque draft, da qualunque sorgente.
 * Non lancia: ritorna gli errori in forma mostrabile all'utente, perche' il caso
 * "JSON quasi giusto" e' la normalita', non l'eccezione.
 */
export function parseReceiptDraft(input: unknown): ParseResult {
  const result = receiptDraftSchema.safeParse(input);
  if (result.success) return { ok: true, draft: result.data };

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(radice)';
    return `${path}: ${issue.message}`;
  });
  return { ok: false, errors };
}

/** Variante per l'import da file: accetta anche una stringa JSON grezza. */
export function parseReceiptDraftJson(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, errors: [`JSON non valido: ${message}`] };
  }
  return parseReceiptDraft(parsed);
}

/** Draft vuoto per l'inserimento manuale. */
export function emptyDraft(now: Date = new Date()): ReceiptDraft {
  return {
    schema_version: SCHEMA_VERSION,
    source: 'manual',
    vendor: { name: '', chain: null, address: null, city: null, vat_number: null },
    purchased_at: now.toISOString(),
    currency: 'EUR',
    payment_method: null,
    total_amount: 0,
    discount_total: null,
    loyalty: null,
    lines: [],
    confidence: null,
    warnings: [],
  };
}
