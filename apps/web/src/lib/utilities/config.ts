import type { UtilityType } from '@ed/db';

/**
 * Configurazione per tipo di utenza.
 *
 * L'unità di consumo non è un dettaglio estetico: è ciò che permette di dire
 * "consumo meno ma pago di più". Per i contratti a forfait (internet fisso) è
 * volutamente null, e la UI smette di chiedere un consumo che non esiste.
 */
export interface UtilityTypeConfig {
  value: UtilityType;
  label: string;
  icon: string;
  /** Unità del consumo, null per i contratti a forfait. */
  unit: string | null;
  unitLabel: string | null;
  categorySlug: string;
  color: string;
}

export const UTILITY_TYPES: readonly UtilityTypeConfig[] = [
  {
    value: 'energia_elettrica',
    label: 'Energia elettrica',
    icon: 'zap',
    unit: 'kWh',
    unitLabel: 'kilowattora',
    categorySlug: 'energia-elettrica',
    color: '#facc15',
  },
  {
    value: 'gas',
    label: 'Gas',
    icon: 'flame',
    unit: 'smc',
    unitLabel: 'metri cubi standard',
    categorySlug: 'gas',
    color: '#fb923c',
  },
  {
    value: 'acqua',
    label: 'Acqua',
    icon: 'droplet',
    unit: 'mc',
    unitLabel: 'metri cubi',
    categorySlug: 'acqua-utenza',
    color: '#38bdf8',
  },
  {
    value: 'rifiuti',
    label: 'Rifiuti',
    icon: 'trash-2',
    unit: null,
    unitLabel: null,
    categorySlug: 'rifiuti',
    color: '#84cc16',
  },
  {
    value: 'telefonia',
    label: 'Telefonia mobile',
    icon: 'smartphone',
    unit: 'GB',
    unitLabel: 'gigabyte',
    categorySlug: 'telefonia',
    color: '#8b5cf6',
  },
  {
    value: 'internet',
    label: 'Internet e fisso',
    icon: 'wifi',
    unit: null,
    unitLabel: null,
    categorySlug: 'internet',
    color: '#3b82f6',
  },
  {
    value: 'altro',
    label: 'Altro',
    icon: 'plug-zap',
    unit: null,
    unitLabel: null,
    categorySlug: 'utenze',
    color: '#ea580c',
  },
];

const BY_VALUE = new Map(UTILITY_TYPES.map((t) => [t.value, t] as const));

export function utilityConfig(type: UtilityType): UtilityTypeConfig {
  return BY_VALUE.get(type) ?? UTILITY_TYPES[UTILITY_TYPES.length - 1]!;
}
