/**
 * Preparazione di un draft per la schermata di revisione.
 *
 * Funzione pura: prende il draft più il contesto già noto all'household
 * (insegne, prodotti, alias) e restituisce tutto ciò che serve a disegnare la
 * revisione. Nessun accesso al database, nessun effetto collaterale — così è
 * testabile per intero e riutilizzabile identica lato client e lato server.
 */

import { toCents, type Cents } from '../money';
import { suggestProductName } from '../matching/normalize';
import {
  resolveProduct,
  resolveVendor,
  type AliasEntry,
  type MatchOutcome,
  type ProductCandidate,
  type VendorCandidate,
} from '../matching/resolve';
import { categorizeLine, type CategorizationResult } from '../taxonomy/categorize';
import { normalizePrice, parsePackageSize, type NormalizedPrice, type Unit } from '../units';
import type { ReceiptDraft, ReceiptLineDraft } from './draft';
import { validateDraft, type DraftValidation, type LineIssue } from './validate';

export interface CatalogContext {
  vendors: readonly VendorCandidate[];
  products: readonly ProductCandidate[];
  aliases: readonly AliasEntry[];
  /** Categoria già associata a ciascun prodotto a catalogo. */
  productCategoryBySlug?: Readonly<Record<string, string>>;
  /** Pezzatura nota per prodotto, per normalizzare i prezzi al pezzo. */
  productPackage?: Readonly<Record<string, { size: number; unit: Unit }>>;
}

export interface PreparedLine {
  lineNo: number;
  rawDescription: string;
  /** Nome leggibile proposto, modificabile dall'utente. */
  suggestedName: string;
  quantity: number;
  unit: Unit;
  unitPrice: number;
  grossCents: Cents;
  discountCents: Cents;
  netCents: Cents;
  vatRate: number | null;
  productMatch: MatchOutcome<ProductCandidate>;
  /** Prodotto agganciato automaticamente, se il match era netto. */
  productId: string | null;
  category: CategorizationResult;
  normalized: NormalizedPrice;
  issues: LineIssue[];
  needsReview: boolean;
}

export interface PreparedReceipt {
  draft: ReceiptDraft;
  vendorMatch: MatchOutcome<VendorCandidate>;
  vendorId: string | null;
  lines: PreparedLine[];
  validation: DraftValidation;
  totals: {
    declared: Cents;
    linesNet: Cents;
    globalDiscount: Cents;
    difference: Cents;
  };
  /** Quota di righe agganciate a un prodotto noto: misura quanto l'app ha già imparato. */
  recognitionRate: number;
}

function matchedId<T extends { id: string }>(outcome: MatchOutcome<T>): string | null {
  if (outcome.kind === 'exact' || outcome.kind === 'auto') return outcome.item.id;
  return null;
}

function prepareLine(
  line: ReceiptLineDraft,
  vendorId: string | null,
  ctx: CatalogContext,
  issues: LineIssue[],
): PreparedLine {
  const productMatch = resolveProduct(line.raw_description, vendorId, ctx.aliases, ctx.products);
  const productId = matchedId(productMatch);

  const category = categorizeLine({
    rawDescription: line.raw_description,
    productCategorySlug: productId ? (ctx.productCategoryBySlug?.[productId] ?? null) : null,
    hint: line.category_hint,
  });

  // La pezzatura viene dal catalogo se il prodotto è noto, altrimenti si prova a
  // leggerla dalla descrizione stessa ("LATTE PS 1L").
  const pkg =
    (productId ? ctx.productPackage?.[productId] : undefined) ??
    parsePackageSize(line.raw_description);

  const normalized = normalizePrice(line.quantity, line.unit, line.unit_price, pkg);

  const grossCents = line.gross_amount != null ? toCents(line.gross_amount) : toCents(line.net_amount);
  const discountCents = line.discount_amount != null ? toCents(line.discount_amount) : 0;
  const lineIssues = issues.filter((i) => i.lineNo === line.line_no);

  return {
    lineNo: line.line_no,
    rawDescription: line.raw_description,
    suggestedName:
      productMatch.kind === 'exact' || productMatch.kind === 'auto'
        ? productMatch.item.name
        : suggestProductName(line.raw_description),
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unit_price,
    grossCents,
    discountCents,
    netCents: toCents(line.net_amount),
    vatRate: line.vat_rate,
    productMatch,
    productId,
    category,
    normalized,
    issues: lineIssues,
    needsReview: lineIssues.length > 0 || productId === null,
  };
}

export function prepareReceipt(draft: ReceiptDraft, ctx: CatalogContext): PreparedReceipt {
  const validation = validateDraft(draft);

  const vendorMatch = resolveVendor(draft.vendor.name, ctx.vendors, draft.vendor.city);
  const vendorId = matchedId(vendorMatch);

  const lines = draft.lines
    .slice()
    .sort((a, b) => a.line_no - b.line_no)
    .map((line) => prepareLine(line, vendorId, ctx, validation.lineIssues));

  const recognized = lines.filter((l) => l.productId !== null).length;

  return {
    draft,
    vendorMatch,
    vendorId,
    lines,
    validation,
    totals: {
      declared: validation.declaredTotal,
      linesNet: validation.computedLinesTotal,
      globalDiscount: draft.discount_total != null ? toCents(draft.discount_total) : 0,
      difference: validation.difference,
    },
    recognitionRate: lines.length === 0 ? 0 : recognized / lines.length,
  };
}
