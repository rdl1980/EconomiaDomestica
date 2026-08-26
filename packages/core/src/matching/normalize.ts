/**
 * Normalizzazione delle descrizioni di scontrino.
 *
 * Scelta importante: la chiave di alias è **puramente meccanica** (minuscole,
 * niente accenti, niente punteggiatura, spazi compattati). Non espande le
 * abbreviazioni.
 *
 * Il motivo: la chiave finisce nel database e ci resta per anni. Se dipendesse da
 * un dizionario di abbreviazioni, ogni volta che aggiungiamo una voce al
 * dizionario cambieremmo la chiave di alias già salvati, che smetterebbero di
 * corrispondere. L'espansione delle abbreviazioni esiste (`suggestProductName`)
 * ma serve solo a proporre un nome leggibile all'utente, non a indicizzare.
 */

/** Chiave stabile usata per l'indice degli alias. Non cambiarla senza migrazione. */
export function normalizeDescription(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // via gli accenti
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ') // via punteggiatura e simboli
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Abbreviazioni ricorrenti sugli scontrini italiani.
 * Serve solo a proporre un nome leggibile in fase di revisione: l'utente resta
 * libero di riscriverlo, e la sua versione è quella che vale.
 */
const ABBREVIATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bpmd\b/g, ''], // prefisso prodotto a marchio distributore
  [/\bpz\b/g, 'pezzi'],
  [/\bconf\b/g, 'confezione'],
  [/\bvasch\b/g, 'vaschetta'],
  [/\bsacch\b/g, 'sacchetto'],
  [/\bbott\b/g, 'bottiglia'],
  [/\bbarat\b/g, 'barattolo'],
  [/\bsurg\b/g, 'surgelato'],
  [/\bfresc\b/g, 'fresco'],
  [/\bbio\b/g, 'biologico'],
  [/\bint\b/g, 'intero'],
  [/\bps\b/g, 'parzialmente scremato'],
  [/\bscrem\b/g, 'scremato'],
  [/\bpomod\b/g, 'pomodoro'],
  [/\bpomodor\b/g, 'pomodoro'],
  [/\bcilieg\b/g, 'ciliegino'],
  [/\binsal\b/g, 'insalata'],
  [/\bpatat\b/g, 'patate'],
  [/\bform\b/g, 'formaggio'],
  [/\bparmig\b/g, 'parmigiano'],
  [/\bregg\b/g, 'reggiano'],
  [/\bprosc\b/g, 'prosciutto'],
  [/\bcrud\b/g, 'crudo'],
  [/\bcott\b/g, 'cotto'],
  [/\bmacin\b/g, 'macinato'],
  [/\bpoll\b/g, 'pollo'],
  [/\bdeterg\b/g, 'detergente'],
  [/\bdeters\b/g, 'detersivo'],
  [/\bigien\b/g, 'igienico'],
  [/\bcarta ig\b/g, 'carta igienica'],
  [/\bacq\b/g, 'acqua'],
  [/\bnat\b/g, 'naturale'],
  [/\bfriz\b/g, 'frizzante'],
];

/** Proposta di nome prodotto leggibile a partire dalla descrizione grezza. */
export function suggestProductName(raw: string): string {
  let text = normalizeDescription(raw);
  for (const [pattern, replacement] of ABBREVIATIONS) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length === 0) return raw.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Normalizzazione dell'insegna: toglie forme societarie e rumore. */
export function normalizeVendorName(raw: string): string {
  return normalizeDescription(raw)
    .replace(/\b(s\s?p\s?a|s\s?r\s?l|s\s?n\s?c|s\s?a\s?s|scarl|societa|coop(erativa)?)\b/g, '')
    .replace(/\bsupermercat[oi]\b/g, '')
    .replace(/\bipermercat[oi]\b/g, '')
    .replace(/\bpunto vendita\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
