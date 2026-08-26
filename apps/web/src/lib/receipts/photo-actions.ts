'use server';

import { createHash, randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { canEdit, requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { extractReceiptFromImage, isVisionConfigured } from '@/lib/vision';

export interface PhotoResult {
  error?: string;
  issues?: string[];
  /** Documento creato anche in caso di lettura fallita: la foto non si perde. */
  documentId?: string;
}

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Foto -> storage -> estrazione -> revisione.
 *
 * Ordine deliberato: la foto viene salvata **prima** di chiamare il modello.
 * Se l'estrazione fallisce, l'immagine resta e il documento resta, in stato
 * `failed`: si può riprovare o inserire a mano senza rifotografare nulla.
 */
export async function extractFromPhoto(
  _prev: PhotoResult,
  formData: FormData,
): Promise<PhotoResult> {
  const session = await requireSession();
  if (!canEdit(session)) return { error: 'Non hai i permessi per aggiungere spese.' };

  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Scegli o scatta una foto dello scontrino.' };
  }
  if (!ACCEPTED.has(file.type)) {
    return { error: 'Formato non supportato: servono JPEG, PNG o WebP.' };
  }
  if (file.size > MAX_BYTES) {
    return { error: 'Immagine troppo grande. Riprova: viene ridimensionata prima dell’invio.' };
  }

  const supabase = await createClient();
  const householdId = session.household.id;

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  // La stessa identica foto non entra due volte.
  const { data: existing } = await supabase
    .from('document')
    .select('id, status')
    .eq('household_id', householdId)
    .eq('sha256', sha256)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'confirmed') {
      return { error: 'Questa foto è già stata caricata e confermata.' };
    }
    redirect(`/revisione/${existing.id}`);
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `${householdId}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) return { error: `Caricamento immagine: ${uploadError.message}` };

  const { data: document, error: insertError } = await supabase
    .from('document')
    .insert({
      household_id: householdId,
      source: 'camera',
      status: isVisionConfigured() ? 'parsing' : 'failed',
      storage_path: storagePath,
      mime_type: file.type,
      byte_size: bytes.byteLength,
      sha256,
      created_by: session.member.id,
      error: isVisionConfigured() ? null : 'Estrazione automatica non configurata.',
    })
    .select('id')
    .single();

  if (insertError) return { error: `Documento: ${insertError.message}` };

  if (!isVisionConfigured()) {
    return {
      error:
        'La lettura automatica non è configurata su questo ambiente. La foto è salvata: puoi inserire lo scontrino a mano o importare un JSON.',
      documentId: document.id,
    };
  }

  const result = await extractReceiptFromImage(
    bytes.toString('base64'),
    file.type as 'image/jpeg' | 'image/png' | 'image/webp',
  );

  if (!result.ok) {
    await supabase
      .from('document')
      .update({ status: 'failed', error: result.message })
      .eq('id', document.id);
    return { error: result.message, issues: result.issues, documentId: document.id };
  }

  await supabase
    .from('document')
    .update({
      status: 'parsed',
      draft: result.draft as unknown as Record<string, unknown>,
      extraction_provider: `vision:${result.model}`,
      error: null,
    })
    .eq('id', document.id);

  redirect(`/revisione/${document.id}`);
}
