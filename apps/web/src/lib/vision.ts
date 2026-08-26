import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { parseReceiptDraft, receiptDraftJsonSchema, type ReceiptDraft } from '@ed/core';

/**
 * Estrazione dei dati da una foto di scontrino.
 *
 * Scelta di progetto: si usa **tool use forzato** con lo schema generato da Zod,
 * e poi si rivalida il risultato con lo stesso schema Zod. Il modello propone,
 * il validatore dispone: se l'output non rispetta il contratto, il documento
 * finisce in stato `failed` con gli errori in chiaro, e l'utente ha comunque
 * l'inserimento manuale e l'import JSON. Nessun dato inventato entra nel ledger
 * per il solo fatto di essere arrivato da un modello.
 *
 * Il modulo è opzionale: senza ANTHROPIC_API_KEY l'app resta completamente
 * utilizzabile, sparisce solo questa scorciatoia.
 */

export const VISION_MODEL = process.env.RECEIPT_VISION_MODEL ?? 'claude-opus-5';

const TOOL_NAME = 'registra_scontrino';

export function isVisionConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM_PROMPT = `Sei un lettore di scontrini della spesa italiani. Estrai i dati e chiamali con lo strumento ${TOOL_NAME}.

REGOLE

1. raw_description deve essere la descrizione ESATTA come stampata sullo scontrino, abbreviazioni e refusi inclusi. Non espandere, non correggere, non tradurre: serve al riconoscimento automatico futuro.

2. Prodotti venduti a peso (frutta, verdura, salumi, carne): lo scontrino riporta il peso e il prezzo al kg. Allora unit = "kg", quantity = il peso in kg (es. 0.482), unit_price = il prezzo al kg. NON mettere 1 come quantita'.

3. Prodotti a pezzo: unit = "pcs", quantity = numero di pezzi, unit_price = prezzo del singolo pezzo. Liquidi a volume: unit = "l".

4. Sconti: se riferiti a una riga, in discount_amount di quella riga, riducendo net_amount. Se generali sul totale, in discount_total.

5. Per ogni riga deve valere, a meno di arrotondamenti:
   quantity * unit_price - discount_amount = net_amount

6. NON INVENTARE. Se un dato non e' leggibile metti null dove il campo lo consente e aggiungi una stringa esplicativa in warnings. Un warning e' sempre meglio di un numero inventato: l'app lo evidenzia per la correzione manuale.

7. Se la somma delle righe non corrisponde al totale, riporta comunque quello che leggi e segnala la discrepanza in warnings. Non aggiustare i numeri per farli tornare.

8. source deve valere "vision".`;

export interface VisionSuccess {
  ok: true;
  draft: ReceiptDraft;
  model: string;
}

export interface VisionFailure {
  ok: false;
  reason: 'not-configured' | 'refused' | 'invalid-output' | 'api-error';
  message: string;
  issues?: string[];
}

export type VisionResult = VisionSuccess | VisionFailure;

export async function extractReceiptFromImage(
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<VisionResult> {
  if (!isVisionConfigured()) {
    return {
      ok: false,
      reason: 'not-configured',
      message:
        'Estrazione automatica non configurata. Puoi importare un JSON o inserire lo scontrino a mano.',
    };
  }

  const client = new Anthropic();

  const request = {
    model: VISION_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: { effort: 'medium' as const },
    tools: [
      {
        name: TOOL_NAME,
        description: 'Registra i dati letti dallo scontrino nel formato ReceiptDraft 1.0.',
        input_schema: receiptDraftJsonSchema() as Anthropic.Tool['input_schema'],
      },
    ],
    tool_choice: { type: 'tool' as const, name: TOOL_NAME },
    messages: [
      {
        role: 'user' as const,
        content: [
          {
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: mediaType, data: base64Image },
          },
          {
            type: 'text' as const,
            text: 'Leggi questo scontrino e registralo. Se qualcosa non è leggibile, dichiaralo nei warnings invece di indovinare.',
          },
        ],
      },
    ],
  };

  let response: Anthropic.Message;
  try {
    response = await client.messages.create(request);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, reason: 'api-error', message: 'Chiave API non valida.' };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return {
        ok: false,
        reason: 'api-error',
        message: 'Troppe richieste in poco tempo: riprova fra qualche istante.',
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: 'api-error', message };
  }

  if (response.stop_reason === 'refusal') {
    return {
      ok: false,
      reason: 'refused',
      message:
        'Il modello non ha voluto elaborare questa immagine. Prova con una foto del solo scontrino, oppure inseriscilo a mano.',
    };
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );

  if (!toolUse) {
    return {
      ok: false,
      reason: 'invalid-output',
      message: 'Non sono riuscito a leggere lo scontrino da questa immagine.',
    };
  }

  // Il validatore Zod è il vero cancello: quello che il modello produce è una
  // proposta, non un dato.
  const parsed = parseReceiptDraft({ ...(toolUse.input as object), source: 'vision' });
  if (!parsed.ok) {
    return {
      ok: false,
      reason: 'invalid-output',
      message: 'La lettura non rispetta il contratto dello scontrino.',
      issues: parsed.errors.slice(0, 8),
    };
  }

  return { ok: true, draft: parsed.draft, model: response.model };
}
