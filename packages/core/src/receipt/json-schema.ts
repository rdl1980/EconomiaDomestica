/**
 * Schema JSON del ReceiptDraft, derivato dallo schema Zod.
 *
 * Serve a descrivere il formato atteso al modello vision. È **generato**, non
 * scritto a mano: se fosse una seconda copia, prima o poi divergerebbe da quella
 * che valida davvero i dati, e il modello si troverebbe a produrre un formato
 * che l'app poi rifiuta.
 */

import { z } from 'zod';
import { receiptDraftSchema } from './draft';

let cached: Record<string, unknown> | null = null;

export function receiptDraftJsonSchema(): Record<string, unknown> {
  if (cached) return cached;
  // `io: 'input'` descrive ciò che il modello deve produrre: i campi con un
  // default sono opzionali in ingresso, ed è giusto che il modello possa
  // ometterli invece di inventarli.
  cached = z.toJSONSchema(receiptDraftSchema, {
    io: 'input',
    target: 'draft-2020-12',
  }) as Record<string, unknown>;
  return cached;
}
