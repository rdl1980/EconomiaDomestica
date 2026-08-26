import { z } from 'zod';
import { PAYMENT_METHODS, UNITS } from '@ed/core';

/**
 * Payload della conferma di uno scontrino.
 *
 * È quello che il form di revisione rimanda al server dopo le correzioni
 * dell'utente. Viene rivalidato qui: il client può sempre mentire, e questa è
 * la scrittura che finisce nel ledger.
 */

export const confirmLineSchema = z.object({
  lineNo: z.int().min(1),
  rawDescription: z.string().trim().min(1).max(300),
  /** Nome leggibile, eventualmente corretto: diventa il nome del prodotto. */
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive(),
  unit: z.enum(UNITS),
  unitPrice: z.number().min(0),
  discountAmount: z.number().min(0).default(0),
  netAmount: z.number(),
  vatRate: z.number().min(0).max(100).nullable().default(null),
  categorySlug: z.string().trim().min(1),
  /** Prodotto già a catalogo, se la riga è stata agganciata. */
  productId: z.uuid().nullable().default(null),
  /** Righe escluse restano nel documento ma non entrano nel ledger. */
  include: z.boolean().default(true),
});

export const confirmReceiptSchema = z.object({
  documentId: z.uuid(),
  vendor: z.object({
    id: z.uuid().nullable().default(null),
    name: z.string().trim().min(1).max(120),
    city: z.string().trim().max(120).nullable().default(null),
    chain: z.string().trim().max(120).nullable().default(null),
  }),
  occurredAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data non valida'),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().default(null),
  totalAmount: z.number(),
  discountTotal: z.number().min(0).default(0),
  notes: z.string().trim().max(500).nullable().default(null),
  lines: z.array(confirmLineSchema).min(1),
});

export type ConfirmLineInput = z.infer<typeof confirmLineSchema>;
export type ConfirmReceiptInput = z.infer<typeof confirmReceiptSchema>;
