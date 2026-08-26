/**
 * Formattazione per la UI, tutta in italiano.
 *
 * Sta qui e non sparsa nei componenti perché la coerenza dei numeri è metà
 * della credibilità di una dashboard: se lo stesso importo appare come "12,44 €"
 * in un posto e "€12.44" in un altro, l'utente smette di fidarsi del resto.
 */

import { fromCents, type Cents } from '@ed/core';

const currencyFmt = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Variante compatta per i titoloni: "1.240 €" invece di "1.240,00 €". */
const currencyRoundFmt = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function euro(cents: Cents): string {
  return currencyFmt.format(fromCents(cents));
}

export function euroRound(cents: Cents): string {
  return currencyRoundFmt.format(fromCents(cents));
}

/** Importo grande spezzato in parte intera e decimali, per dare gerarchia tipografica. */
export function euroParts(cents: Cents): { whole: string; decimals: string } {
  const value = fromCents(Math.abs(cents));
  const whole = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(
    Math.floor(value),
  );
  const decimals = String(Math.round((value - Math.floor(value)) * 100)).padStart(2, '0');
  return { whole: `${cents < 0 ? '−' : ''}${whole}`, decimals };
}

export function percent(value: number, digits = 0): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value / 100);
}

/** Variazione con segno esplicito: "+12%" è più leggibile di "12%". */
export function signedPercent(value: number | null, digits = 0): string {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(value))}%`;
}

export function quantity(value: number, unit: 'pcs' | 'kg' | 'l'): string {
  const label = unit === 'pcs' ? 'pz' : unit === 'kg' ? 'kg' : 'L';
  const formatted = new Intl.NumberFormat('it-IT', {
    maximumFractionDigits: unit === 'pcs' ? 0 : 3,
  }).format(value);
  return `${formatted} ${label}`;
}

export function unitPrice(value: number, unit: 'pcs' | 'kg' | 'l'): string {
  const label = unit === 'pcs' ? 'pz' : unit === 'kg' ? 'kg' : 'L';
  const decimals = value < 1 && value !== 0 ? 4 : 2;
  return `${new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  }).format(value)} €/${label}`;
}

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

export function fullDate(value: string | Date): string {
  return dateFmt.format(typeof value === 'string' ? new Date(value) : value);
}

export function shortDate(value: string | Date): string {
  return shortDateFmt.format(typeof value === 'string' ? new Date(value) : value);
}

export function dateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${dateFmt.format(d)} alle ${timeFmt.format(d)}`;
}

/** "oggi", "ieri", "3 giorni fa": in un elenco di spese conta più della data esatta. */
export function relativeDay(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const today = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(today) - startOfDay(d)) / 86_400_000);

  if (days === 0) return 'oggi';
  if (days === 1) return 'ieri';
  if (days < 7) return `${days} giorni fa`;
  return fullDate(d);
}
