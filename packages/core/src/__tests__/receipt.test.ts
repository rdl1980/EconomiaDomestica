import { describe, expect, it } from 'vitest';
import { parseReceiptDraft, parseReceiptDraftJson } from '../receipt/draft';
import { prepareReceipt } from '../receipt/prepare';
import { hasBlockingIssues, validateDraft } from '../receipt/validate';
import { draftWith, esselungaDraft } from './fixtures';

describe('parseReceiptDraft', () => {
  it('accetta un draft conforme', () => {
    const result = parseReceiptDraft(esselungaDraft);
    expect(result.ok).toBe(true);
  });

  it('applica i default sui campi opzionali', () => {
    const minimal = {
      schema_version: '1.0',
      source: 'manual',
      vendor: { name: 'COOP' },
      purchased_at: '2026-08-20T10:00:00+02:00',
      total_amount: 5,
      lines: [
        {
          line_no: 1,
          raw_description: 'PANE',
          quantity: 1,
          unit: 'pcs',
          unit_price: 5,
          net_amount: 5,
        },
      ],
    };
    const result = parseReceiptDraft(minimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.currency).toBe('EUR');
    expect(result.draft.warnings).toEqual([]);
    expect(result.draft.payment_method).toBeNull();
  });

  it('rifiuta i campi sconosciuti invece di ignorarli', () => {
    const result = parseReceiptDraft({ ...esselungaDraft, totale: 12.44 });
    expect(result.ok).toBe(false);
  });

  it('restituisce errori leggibili con il percorso del campo', () => {
    const broken = draftWith({
      lines: [{ ...esselungaDraft.lines[0]!, quantity: -1 }],
    });
    const result = parseReceiptDraft(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain('lines.0.quantity');
  });

  it('non esplode su JSON malformato', () => {
    const result = parseReceiptDraftJson('{ non sono json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain('JSON non valido');
  });
});

describe('validateDraft', () => {
  it('considera quadrato uno scontrino coerente', () => {
    const v = validateDraft(esselungaDraft);
    expect(v.isBalanced).toBe(true);
    expect(v.declaredTotal).toBe(1244);
    expect(v.computedLinesTotal).toBe(1244);
    expect(hasBlockingIssues(v)).toBe(false);
  });

  it('segnala lo scarto fra somma righe e totale senza bloccare', () => {
    const v = validateDraft(draftWith({ total_amount: 15.0 }));
    expect(v.isBalanced).toBe(false);
    expect(hasBlockingIssues(v)).toBe(false);
    expect(v.receiptIssues.some((i) => i.message.includes('non corrisponde al totale'))).toBe(true);
  });

  it('indica quale riga non torna, non tutte', () => {
    const broken = draftWith({
      lines: [
        esselungaDraft.lines[0]!,
        { ...esselungaDraft.lines[1]!, net_amount: 5.0 },
        esselungaDraft.lines[2]!,
      ],
      total_amount: 15.56,
    });
    const v = validateDraft(broken);
    expect(v.linesNeedingReview).toEqual([2]);
  });

  it('tratta come errore uno sconto maggiore dell importo di riga', () => {
    const broken = draftWith({
      lines: [{ ...esselungaDraft.lines[0]!, discount_amount: 10, net_amount: -7.42 }],
      total_amount: 0.01,
    });
    const v = validateDraft(broken);
    expect(hasBlockingIssues(v)).toBe(true);
  });

  it('sospetta una quantita a peso perfettamente intera', () => {
    const suspicious = draftWith({
      lines: [{ ...esselungaDraft.lines[1]!, quantity: 1, net_amount: 3.9 }],
      total_amount: 3.9,
    });
    const v = validateDraft(suspicious);
    expect(v.lineIssues.some((i) => i.message.includes('perfettamente intera'))).toBe(true);
  });

  it('riporta i warning dichiarati dalla sorgente di estrazione', () => {
    const v = validateDraft(draftWith({ warnings: ['ora illeggibile'] }));
    expect(v.receiptIssues.some((i) => i.message.includes('ora illeggibile'))).toBe(true);
  });
});

describe('prepareReceipt', () => {
  const emptyCatalog = { vendors: [], products: [], aliases: [] };

  it('prepara le righe anche con catalogo vuoto', () => {
    const prepared = prepareReceipt(esselungaDraft, emptyCatalog);
    expect(prepared.lines).toHaveLength(3);
    expect(prepared.vendorMatch.kind).toBe('none');
    expect(prepared.recognitionRate).toBe(0);
    // Nessun prodotto noto: tutte le righe vanno riviste.
    expect(prepared.lines.every((l) => l.needsReview)).toBe(true);
  });

  it('propone un nome leggibile a partire dalle abbreviazioni', () => {
    const prepared = prepareReceipt(esselungaDraft, emptyCatalog);
    expect(prepared.lines[0]!.suggestedName.toLowerCase()).toContain('latte');
    expect(prepared.lines[0]!.suggestedName.toLowerCase()).not.toContain('pmd');
  });

  it('categorizza per regole quando il prodotto non e a catalogo', () => {
    const prepared = prepareReceipt(esselungaDraft, emptyCatalog);
    expect(prepared.lines[0]!.category.slug).toBe('latticini');
    expect(prepared.lines[1]!.category.slug).toBe('ortofrutta');
  });

  it('aggancia insegna e prodotto quando li conosce, e alza il tasso di riconoscimento', () => {
    const prepared = prepareReceipt(esselungaDraft, {
      vendors: [{ id: 'v1', name: 'Esselunga', city: 'Milano' }],
      products: [{ id: 'p1', name: 'Latte parzialmente scremato 1L', brand: null }],
      aliases: [{ normalized: 'pmd latte ps 1l', productId: 'p1', vendorId: 'v1' }],
    });
    expect(prepared.vendorId).toBe('v1');
    expect(prepared.lines[0]!.productId).toBe('p1');
    expect(prepared.lines[0]!.productMatch.kind).toBe('exact');
    expect(prepared.recognitionRate).toBeCloseTo(1 / 3);
  });

  it('normalizza al kg il prezzo di un prodotto a pezzo di cui conosce la pezzatura', () => {
    const prepared = prepareReceipt(esselungaDraft, emptyCatalog);
    // "PMD LATTE PS 1L": la pezzatura si legge dalla descrizione stessa.
    const latte = prepared.lines[0]!;
    expect(latte.normalized.unit).toBe('l');
    expect(latte.normalized.unitPrice).toBe(1.29);
    expect(latte.normalized.isComparableByWeight).toBe(true);
  });
});
