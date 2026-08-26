/**
 * Validazione contabile di un ReceiptDraft.
 *
 * Filosofia: **non si blocca mai l'import**. Uno scontrino che non torna e' un
 * fatto normale (arrotondamenti, sconti stampati male, righe illeggibili). Il
 * compito di questo modulo e' dire *quali* righe sono sospette, cosi' la
 * schermata di revisione ne evidenzia tre invece di far ricontrollare tutte e
 * quaranta.
 *
 * Gli errori strutturali li ha gia' intercettati lo schema Zod. Qui si controlla
 * solo se i numeri sono coerenti fra loro.
 */

import {
  LINE_TOLERANCE_CENTS,
  lineAmountCents,
  sumCents,
  toCents,
  totalToleranceCents,
  withinTolerance,
  type Cents,
} from '../money';
import type { ReceiptDraft, ReceiptLineDraft } from './draft';

export type IssueSeverity = 'error' | 'warning';

export interface LineIssue {
  lineNo: number;
  severity: IssueSeverity;
  message: string;
}

export interface ReceiptIssue {
  severity: IssueSeverity;
  message: string;
}

export interface DraftValidation {
  lineIssues: LineIssue[];
  receiptIssues: ReceiptIssue[];
  /** Righe da evidenziare in revisione. */
  linesNeedingReview: number[];
  /** Somma dei netti riga. */
  computedLinesTotal: Cents;
  /** Totale dichiarato sullo scontrino. */
  declaredTotal: Cents;
  /** Scarto fra i due, con segno. */
  difference: Cents;
  /** true se lo scontrino quadra entro tolleranza. */
  isBalanced: boolean;
}

/** Netto atteso di una riga, ricalcolato da quantita' e prezzo unitario. */
export function expectedLineNet(line: ReceiptLineDraft): Cents {
  const gross = lineAmountCents(line.quantity, line.unit_price);
  const discount = line.discount_amount != null ? toCents(line.discount_amount) : 0;
  return gross - discount;
}

function validateLine(line: ReceiptLineDraft): LineIssue[] {
  const issues: LineIssue[] = [];
  const lineNo = line.line_no;

  const computedGross = lineAmountCents(line.quantity, line.unit_price);
  const declaredNet = toCents(line.net_amount);
  const discount = line.discount_amount != null ? toCents(line.discount_amount) : 0;

  if (line.gross_amount != null) {
    const declaredGross = toCents(line.gross_amount);
    if (!withinTolerance(computedGross, declaredGross, LINE_TOLERANCE_CENTS)) {
      issues.push({
        lineNo,
        severity: 'warning',
        message: `Quantità × prezzo unitario dà ${fmt(computedGross)}, ma l'importo lordo dichiarato è ${fmt(declaredGross)}.`,
      });
    }
    if (!withinTolerance(declaredGross - discount, declaredNet, LINE_TOLERANCE_CENTS)) {
      issues.push({
        lineNo,
        severity: 'warning',
        message: `Lordo meno sconto dà ${fmt(declaredGross - discount)}, ma il netto dichiarato è ${fmt(declaredNet)}.`,
      });
    }
  } else if (!withinTolerance(computedGross - discount, declaredNet, LINE_TOLERANCE_CENTS)) {
    issues.push({
      lineNo,
      severity: 'warning',
      message: `Quantità × prezzo unitario meno sconto dà ${fmt(computedGross - discount)}, ma il netto dichiarato è ${fmt(declaredNet)}.`,
    });
  }

  if (discount > 0 && discount > computedGross + LINE_TOLERANCE_CENTS) {
    issues.push({
      lineNo,
      severity: 'error',
      message: `Lo sconto (${fmt(discount)}) è maggiore dell'importo della riga.`,
    });
  }

  // Un prodotto a peso con quantita' intera tonda e' quasi sempre un errore di
  // lettura: la bilancia non pesa mai esattamente 1,000 kg.
  if ((line.unit === 'kg' || line.unit === 'l') && Number.isInteger(line.quantity)) {
    issues.push({
      lineNo,
      severity: 'warning',
      message: `Quantità a peso perfettamente intera (${line.quantity} ${line.unit}): verifica che non sia il numero di pezzi.`,
    });
  }

  if (line.unit_price === 0 && line.net_amount !== 0) {
    issues.push({
      lineNo,
      severity: 'warning',
      message: 'Prezzo unitario a zero ma importo diverso da zero.',
    });
  }

  return issues;
}

function fmt(cents: Cents): string {
  return `${(cents / 100).toFixed(2)} €`;
}

export function validateDraft(draft: ReceiptDraft): DraftValidation {
  const lineIssues: LineIssue[] = [];
  const receiptIssues: ReceiptIssue[] = [];

  const seenLineNumbers = new Set<number>();
  for (const line of draft.lines) {
    if (seenLineNumbers.has(line.line_no)) {
      receiptIssues.push({
        severity: 'error',
        message: `Numero di riga duplicato: ${line.line_no}.`,
      });
    }
    seenLineNumbers.add(line.line_no);
    lineIssues.push(...validateLine(line));
  }

  const computedLinesTotal = sumCents(draft.lines.map((l) => toCents(l.net_amount)));
  const globalDiscount = draft.discount_total != null ? toCents(draft.discount_total) : 0;
  const declaredTotal = toCents(draft.total_amount);
  const expectedTotal = computedLinesTotal - globalDiscount;
  const difference = expectedTotal - declaredTotal;
  const tolerance = totalToleranceCents(draft.lines.length);
  const isBalanced = Math.abs(difference) <= tolerance;

  if (!isBalanced) {
    receiptIssues.push({
      severity: 'warning',
      message:
        `La somma delle righe (${fmt(expectedTotal)}) non corrisponde al totale dichiarato ` +
        `(${fmt(declaredTotal)}): scarto di ${fmt(Math.abs(difference))}. ` +
        (difference > 0
          ? 'Potrebbe mancare uno sconto, oppure una riga è stata letta due volte.'
          : 'Potrebbe mancare una riga.'),
    });
  }

  const purchasedAt = new Date(draft.purchased_at);
  const now = Date.now();
  if (purchasedAt.getTime() > now + 24 * 60 * 60 * 1000) {
    receiptIssues.push({
      severity: 'warning',
      message: 'La data di acquisto è nel futuro.',
    });
  }
  if (purchasedAt.getUTCFullYear() < 2000) {
    receiptIssues.push({
      severity: 'warning',
      message: 'La data di acquisto sembra implausibile.',
    });
  }

  if (draft.total_amount <= 0) {
    receiptIssues.push({
      severity: 'error',
      message: 'Il totale dello scontrino deve essere maggiore di zero.',
    });
  }

  // I warning prodotti dalla sorgente di estrazione contano come segnali: chi ha
  // letto lo scontrino ha gia' dichiarato di non essere sicuro.
  for (const warning of draft.warnings) {
    receiptIssues.push({ severity: 'warning', message: `Segnalato in estrazione: ${warning}` });
  }

  const linesNeedingReview = [...new Set(lineIssues.map((i) => i.lineNo))].sort((a, b) => a - b);

  return {
    lineIssues,
    receiptIssues,
    linesNeedingReview,
    computedLinesTotal,
    declaredTotal,
    difference,
    isBalanced,
  };
}

/** true se il draft può essere confermato senza intervento umano obbligatorio. */
export function hasBlockingIssues(validation: DraftValidation): boolean {
  return (
    validation.lineIssues.some((i) => i.severity === 'error') ||
    validation.receiptIssues.some((i) => i.severity === 'error')
  );
}
