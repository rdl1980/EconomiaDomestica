/**
 * Conversione fra le righe del database e i tipi del dominio.
 *
 * Esiste per un motivo preciso: PostgREST serializza i `numeric` come stringa,
 * per non perdere precisione. Se quella stringa arriva ai componenti, prima o
 * poi qualcuno scrive `a.total + b.total` e ottiene "12.4415.60".
 *
 * Qui la conversione avviene una volta sola, all'ingresso, e da lì in poi nel
 * codice circolano solo centesimi interi.
 */

import { toCents, type Cents } from '@ed/core';
import type { LineItemRow, Numeric, TransactionRow } from './types';

export function numericToCents(value: Numeric | null | undefined): Cents {
  if (value == null) return 0;
  return toCents(Number(value));
}

export function numericToNumber(value: Numeric | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

export function centsToNumeric(cents: Cents): string {
  return (cents / 100).toFixed(2);
}

export function unitPriceToNumeric(value: number): string {
  return value.toFixed(4);
}

export function quantityToNumeric(value: number): string {
  return value.toFixed(3);
}

export interface TransactionDomain {
  id: string;
  module: TransactionRow['module'];
  vendorId: string | null;
  documentId: string | null;
  occurredAt: Date;
  totalCents: Cents;
  discountCents: Cents;
  currency: string;
  paymentMethod: string | null;
  notes: string | null;
}

export function toTransaction(row: TransactionRow): TransactionDomain {
  return {
    id: row.id,
    module: row.module,
    vendorId: row.vendor_id,
    documentId: row.document_id,
    occurredAt: new Date(row.occurred_at),
    totalCents: numericToCents(row.total_amount),
    discountCents: numericToCents(row.discount_total),
    currency: row.currency,
    paymentMethod: row.payment_method,
    notes: row.notes,
  };
}

export interface LineItemDomain {
  id: string;
  transactionId: string;
  lineNo: number;
  rawDescription: string;
  productId: string | null;
  categoryId: string | null;
  quantity: number;
  unit: LineItemRow['unit'];
  unitPrice: number;
  grossCents: Cents;
  discountCents: Cents;
  netCents: Cents;
  vatRate: number | null;
  needsReview: boolean;
}

export function toLineItem(row: LineItemRow): LineItemDomain {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    lineNo: row.line_no,
    rawDescription: row.raw_description,
    productId: row.product_id,
    categoryId: row.category_id,
    quantity: numericToNumber(row.quantity),
    unit: row.unit,
    unitPrice: numericToNumber(row.unit_price),
    grossCents: numericToCents(row.gross_amount),
    discountCents: numericToCents(row.discount_amount),
    netCents: numericToCents(row.net_amount),
    vatRate: row.vat_rate == null ? null : Number(row.vat_rate),
    needsReview: row.needs_review,
  };
}
