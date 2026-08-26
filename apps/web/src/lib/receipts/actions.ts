'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  aliasKeyFor,
  normalizePrice,
  parsePackageSize,
  parseReceiptDraft,
  parseReceiptDraftJson,
  toCents,
  type ReceiptDraft,
} from '@ed/core';
import {
  centsToNumeric,
  quantityToNumeric,
  unitPriceToNumeric,
  type Unit,
} from '@ed/db';
import { getCategoryMap } from '@/lib/data/catalog';
import { requireSession, canEdit } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { confirmReceiptSchema } from './schema';

export interface ImportResult {
  error?: string;
  /** Errori di validazione riga per riga, mostrabili senza perdere l'input. */
  issues?: string[];
}

/* -------------------------------------------------------------------------- */
/* Ingresso: crea il documento a partire da un draft                           */
/* -------------------------------------------------------------------------- */

/**
 * Registra un draft e manda in revisione.
 *
 * È il punto in cui convergono tutte le sorgenti: da qui in poi il percorso è
 * identico, che il draft venga dalla vision, da un file JSON o dalla tastiera.
 */
async function createDocumentFromDraft(
  draft: ReceiptDraft,
  options: {
    source: 'camera' | 'upload' | 'json_import' | 'manual';
    storagePath?: string | null;
    sha256?: string | null;
    mimeType?: string | null;
    byteSize?: number | null;
    provider?: string | null;
  },
): Promise<string> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('document')
    .insert({
      household_id: session.household.id,
      source: options.source,
      status: 'parsed',
      draft: draft as unknown as Record<string, unknown>,
      storage_path: options.storagePath ?? null,
      sha256: options.sha256 ?? null,
      mime_type: options.mimeType ?? null,
      byte_size: options.byteSize ?? null,
      extraction_provider: options.provider ?? null,
      created_by: session.member.id,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

/** Import di un JSON prodotto fuori dall'app. Input non fidato: validazione severa. */
export async function importJsonDraft(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const session = await requireSession();
  if (!canEdit(session)) return { error: 'Non hai i permessi per aggiungere spese.' };

  const pasted = String(formData.get('json') ?? '').trim();
  const file = formData.get('file');

  let raw = pasted;
  if (!raw && file instanceof File && file.size > 0) {
    if (file.size > 2_000_000) return { error: 'Il file è troppo grande per essere uno scontrino.' };
    raw = await file.text();
  }

  if (!raw) return { error: 'Incolla il JSON oppure scegli un file.' };

  const parsed = parseReceiptDraftJson(raw);
  if (!parsed.ok) {
    return {
      error: 'Il JSON non rispetta il contratto dello scontrino.',
      issues: parsed.errors.slice(0, 12),
    };
  }

  // La sorgente dichiarata dal file non fa fede: qui sappiamo com'è arrivato.
  const draft: ReceiptDraft = { ...parsed.draft, source: 'external' };
  const documentId = await createDocumentFromDraft(draft, {
    source: 'json_import',
    provider: 'external',
  });

  redirect(`/revisione/${documentId}`);
}

/** Inserimento manuale: il draft arriva già costruito dal form. */
export async function saveManualDraft(input: unknown): Promise<{ id: string } | { error: string }> {
  const session = await requireSession();
  if (!canEdit(session)) return { error: 'Non hai i permessi per aggiungere spese.' };

  const parsed = parseReceiptDraft(input);
  if (!parsed.ok) return { error: parsed.errors.slice(0, 5).join(' · ') };

  const id = await createDocumentFromDraft({ ...parsed.draft, source: 'manual' }, {
    source: 'manual',
    provider: 'manual',
  });
  return { id };
}

/* -------------------------------------------------------------------------- */
/* Uscita: conferma verso il ledger                                            */
/* -------------------------------------------------------------------------- */

export interface ConfirmResult {
  error?: string;
}

/**
 * Scrive lo scontrino confermato nel ledger.
 *
 * Fa cinque cose, in quest'ordine:
 *   1. risolve o crea l'insegna
 *   2. crea la transazione
 *   3. per ogni riga inclusa, crea il prodotto se manca e registra l'alias
 *      (è qui che l'app impara: la prossima volta la riga si aggancia da sola)
 *   4. scrive le righe e le osservazioni di prezzo normalizzate
 *   5. marca il documento come confermato
 *
 * Nota sull'atomicità: PostgREST non espone transazioni multi-statement, quindi
 * in caso di errore a metà strada resta una transazione parziale. Il documento
 * però non passa a `confirmed`, quindi lo stato incoerente è visibile e
 * ripetibile invece che silenzioso. Una funzione RPC transazionale è la
 * chiusura naturale di questo punto.
 */
export async function confirmReceipt(input: unknown): Promise<ConfirmResult> {
  const session = await requireSession();
  if (!canEdit(session)) return { error: 'Non hai i permessi per confermare spese.' };

  const parsed = confirmReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)[0] };
  }
  const payload = parsed.data;
  const householdId = session.household.id;
  const supabase = await createClient();

  const lines = payload.lines.filter((l) => l.include);
  if (lines.length === 0) return { error: 'Nessuna riga da salvare.' };

  // 1. insegna
  let vendorId = payload.vendor.id;
  if (!vendorId) {
    const { data, error } = await supabase
      .from('vendor')
      .insert({
        household_id: householdId,
        name: payload.vendor.name,
        chain: payload.vendor.chain,
        city: payload.vendor.city,
        type: 'supermercato',
      })
      .select('id')
      .single();
    if (error) return { error: `Insegna: ${error.message}` };
    vendorId = data.id;
  }

  // 2. transazione
  const { data: transaction, error: txError } = await supabase
    .from('transaction')
    .insert({
      household_id: householdId,
      module: 'spesa',
      vendor_id: vendorId,
      document_id: payload.documentId,
      occurred_at: new Date(payload.occurredAt).toISOString(),
      total_amount: centsToNumeric(toCents(payload.totalAmount)),
      discount_total: centsToNumeric(toCents(payload.discountTotal)),
      payment_method: payload.paymentMethod,
      notes: payload.notes,
      created_by: session.member.id,
    })
    .select('id')
    .single();
  if (txError) return { error: `Spesa: ${txError.message}` };

  // 3. prodotti mancanti + alias
  const categoryMap = await getCategoryMap(householdId);
  const productIdByLine = new Map<number, string>();
  const newProducts = lines.filter((l) => !l.productId);

  if (newProducts.length > 0) {
    // Due righe dello stesso scontrino possono riferirsi allo stesso prodotto
    // (es. lo stesso yogurt battuto due volte): un solo prodotto, due alias.
    const byName = new Map<string, typeof newProducts>();
    for (const line of newProducts) {
      const key = line.name.toLowerCase();
      const bucket = byName.get(key);
      if (bucket) bucket.push(line);
      else byName.set(key, [line]);
    }

    const rows = [...byName.values()].map((group) => {
      const first = group[0]!;
      const pkg = parsePackageSize(first.rawDescription) ?? parsePackageSize(first.name);
      return {
        household_id: householdId,
        name: first.name,
        default_unit: first.unit,
        default_category_id: categoryMap.get(first.categorySlug) ?? null,
        package_size: pkg ? quantityToNumeric(pkg.size) : null,
        package_unit: pkg ? (pkg.unit as Unit) : null,
      };
    });

    const { data: created, error: productError } = await supabase
      .from('product')
      .insert(rows)
      .select('id, name');
    if (productError) return { error: `Prodotti: ${productError.message}` };

    const idByName = new Map((created ?? []).map((p) => [p.name.toLowerCase(), p.id] as const));
    for (const line of newProducts) {
      const id = idByName.get(line.name.toLowerCase());
      if (id) productIdByLine.set(line.lineNo, id);
    }
  }

  for (const line of lines) {
    if (line.productId) productIdByLine.set(line.lineNo, line.productId);
  }

  // Gli alias sono per insegna: la stessa abbreviazione può significare cose
  // diverse da Esselunga e da Conad.
  const aliasRows = lines
    .map((line) => {
      const productId = productIdByLine.get(line.lineNo);
      if (!productId) return null;
      return {
        household_id: householdId,
        vendor_id: vendorId,
        normalized: aliasKeyFor(line.rawDescription),
        product_id: productId,
        source: 'user' as const,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (aliasRows.length > 0) {
    // Dedup interno: la stessa descrizione due volte nello stesso scontrino
    // produrrebbe due righe in conflitto sull'indice unico.
    const seen = new Set<string>();
    const unique = aliasRows.filter((r) => {
      if (seen.has(r.normalized)) return false;
      seen.add(r.normalized);
      return true;
    });
    await supabase.from('product_alias').upsert(unique, {
      onConflict: 'household_id,vendor_id,normalized',
      ignoreDuplicates: true,
    });
  }

  // 4. righe + osservazioni di prezzo
  const lineRows = lines.map((line) => {
    const gross = toCents(line.quantity * line.unitPrice);
    return {
      household_id: householdId,
      transaction_id: transaction.id,
      line_no: line.lineNo,
      raw_description: line.rawDescription,
      product_id: productIdByLine.get(line.lineNo) ?? null,
      category_id: categoryMap.get(line.categorySlug) ?? null,
      quantity: quantityToNumeric(line.quantity),
      unit: line.unit,
      unit_price: unitPriceToNumeric(line.unitPrice),
      gross_amount: centsToNumeric(gross),
      discount_amount: centsToNumeric(toCents(line.discountAmount)),
      net_amount: centsToNumeric(toCents(line.netAmount)),
      vat_rate: line.vatRate == null ? null : String(line.vatRate),
      needs_review: false,
    };
  });

  const { data: insertedLines, error: lineError } = await supabase
    .from('line_item')
    .insert(lineRows)
    .select('id, line_no');
  if (lineError) return { error: `Righe: ${lineError.message}` };

  const lineIdByNo = new Map((insertedLines ?? []).map((l) => [l.line_no, l.id] as const));
  const observedOn = new Date(payload.occurredAt).toISOString().slice(0, 10);

  const priceRows = lines
    .map((line) => {
      const productId = productIdByLine.get(line.lineNo);
      if (!productId) return null;
      const pkg = parsePackageSize(line.rawDescription) ?? parsePackageSize(line.name);
      const normalized = normalizePrice(line.quantity, line.unit, line.unitPrice, pkg);
      return {
        household_id: householdId,
        product_id: productId,
        vendor_id: vendorId,
        observed_on: observedOn,
        normalized_unit: normalized.unit,
        unit_price_normalized: unitPriceToNumeric(normalized.unitPrice),
        was_discounted: line.discountAmount > 0,
        line_item_id: lineIdByNo.get(line.lineNo) ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (priceRows.length > 0) {
    const { error: priceError } = await supabase.from('price_observation').insert(priceRows);
    if (priceError) return { error: `Storico prezzi: ${priceError.message}` };
  }

  // 5. documento confermato
  await supabase
    .from('document')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', payload.documentId);

  revalidatePath('/dashboard');
  revalidatePath('/spese');
  redirect(`/spese/${transaction.id}`);
}

export async function discardDocument(documentId: string): Promise<void> {
  await requireSession();
  const supabase = await createClient();
  await supabase.from('document').update({ status: 'discarded' }).eq('id', documentId);
  revalidatePath('/cattura');
  redirect('/cattura');
}
