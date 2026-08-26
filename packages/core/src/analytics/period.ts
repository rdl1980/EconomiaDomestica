/**
 * Periodi di analisi.
 *
 * Un mese "corrente" non è confrontabile con un mese completo, e mostrarli
 * affiancati senza dirlo è il modo più veloce per far prendere una decisione
 * sbagliata a chi guarda la dashboard. Qui i periodi sanno se sono parziali, e
 * la UI ha l'obbligo di dichiararlo.
 *
 * Tutte le funzioni lavorano su date locali dell'household (default Europe/Rome):
 * uno scontrino delle 23:40 del 31 gennaio appartiene a gennaio, non a febbraio.
 */

export type PeriodGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface Period {
  /** Inizio incluso. */
  start: Date;
  /** Fine esclusa. */
  end: Date;
  granularity: PeriodGranularity;
  label: string;
  /** true se il periodo non è ancora concluso. */
  isPartial: boolean;
  /** Frazione di periodo trascorsa, 0..1. Serve per proiettare a fine periodo. */
  elapsedFraction: number;
}

const MONTH_NAMES = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

function build(
  start: Date,
  end: Date,
  granularity: PeriodGranularity,
  label: string,
  now: Date,
): Period {
  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  const isPartial = now >= start && now < end;
  return {
    start,
    end,
    granularity,
    label,
    isPartial,
    elapsedFraction: total <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / total)),
  };
}

export function monthPeriod(year: number, month: number, now: Date = new Date()): Period {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  return build(start, end, 'month', `${MONTH_NAMES[month]} ${year}`, now);
}

export function currentMonth(now: Date = new Date()): Period {
  return monthPeriod(now.getFullYear(), now.getMonth(), now);
}

export function previousMonth(now: Date = new Date()): Period {
  const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return monthPeriod(ref.getFullYear(), ref.getMonth(), now);
}

/** Stesso mese dell'anno precedente: è il confronto giusto per la spesa alimentare, che è stagionale. */
export function sameMonthLastYear(now: Date = new Date()): Period {
  return monthPeriod(now.getFullYear() - 1, now.getMonth(), now);
}

export function yearPeriod(year: number, now: Date = new Date()): Period {
  return build(new Date(year, 0, 1), new Date(year + 1, 0, 1), 'year', String(year), now);
}

/** Settimana ISO, da lunedì a lunedì. */
export function weekPeriod(reference: Date, now: Date = new Date()): Period {
  const day = reference.getDay();
  const offsetToMonday = (day + 6) % 7;
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() - offsetToMonday);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const label = `settimana del ${start.getDate()} ${MONTH_NAMES[start.getMonth()]}`;
  return build(start, end, 'week', label, now);
}

/** Ultimi N giorni conclusi più quello corrente. Utile per i trend brevi. */
export function lastDays(days: number, now: Date = new Date()): Period {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - days);
  return build(start, end, 'day', `ultimi ${days} giorni`, now);
}

/** Periodo immediatamente precedente, di pari durata: la base di ogni confronto. */
export function precedingPeriod(period: Period, now: Date = new Date()): Period {
  const duration = period.end.getTime() - period.start.getTime();
  const start = new Date(period.start.getTime() - duration);
  const end = new Date(period.start.getTime());
  return build(start, end, period.granularity, `periodo precedente`, now);
}

/**
 * Proiezione a fine periodo di un valore parziale.
 * Ritorna null quando il periodo è concluso (non c'è nulla da proiettare) o
 * quando è appena iniziato: proiettare la spesa del mese dal solo giorno 1
 * produce numeri ridicoli, meglio non mostrare nulla.
 */
export function projectToPeriodEnd(valueSoFar: number, period: Period): number | null {
  if (!period.isPartial) return null;
  if (period.elapsedFraction < 0.15) return null;
  return Math.round(valueSoFar / period.elapsedFraction);
}

/** Chiave stabile per raggruppare per mese: "2026-08". */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Elenco delle chiavi mese fra due date, estremi inclusi. Serve a non far sparire i mesi vuoti dai grafici. */
export function monthKeysBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const last = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= last) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}
