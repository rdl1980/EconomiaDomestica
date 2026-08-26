/**
 * Tassonomia di sistema.
 *
 * È un seed, non una gabbia: ogni household può aggiungere categorie proprie.
 * Gli slug sono identificatori stabili e non vanno più cambiati una volta in
 * produzione, perché finiscono nello storico e nelle regole di categorizzazione.
 *
 * I domini oltre `spesa` sono già qui anche se i moduli corrispondenti arrivano
 * dopo: così la dashboard totale ha senso fin dal primo giorno e non serve una
 * migrazione quando si accende il modulo utenze.
 */

export const CATEGORY_DOMAINS = [
  'spesa',
  'utenze',
  'casa',
  'trasporti',
  'salute',
  'tempo_libero',
  'altro',
] as const;
export type CategoryDomain = (typeof CATEGORY_DOMAINS)[number];

export interface SeedCategory {
  slug: string;
  name: string;
  domain: CategoryDomain;
  /** slug del genitore, null per le radici. */
  parent: string | null;
  /** Nome icona lucide-react. */
  icon: string;
  /** Colore stabile: usato ovunque, grafici compresi. */
  color: string;
}

export const SEED_CATEGORIES: readonly SeedCategory[] = [
  // ---------------------------------------------------------------- Alimentari
  { slug: 'alimentari', name: 'Alimentari', domain: 'spesa', parent: null, icon: 'shopping-basket', color: '#16a34a' },
  { slug: 'ortofrutta', name: 'Frutta e verdura', domain: 'spesa', parent: 'alimentari', icon: 'apple', color: '#65a30d' },
  { slug: 'carne', name: 'Carne', domain: 'spesa', parent: 'alimentari', icon: 'beef', color: '#dc2626' },
  { slug: 'pesce', name: 'Pesce', domain: 'spesa', parent: 'alimentari', icon: 'fish', color: '#0ea5e9' },
  { slug: 'salumi', name: 'Salumi', domain: 'spesa', parent: 'alimentari', icon: 'ham', color: '#f87171' },
  { slug: 'latticini', name: 'Latticini e uova', domain: 'spesa', parent: 'alimentari', icon: 'milk', color: '#fbbf24' },
  { slug: 'panetteria', name: 'Pane e panetteria', domain: 'spesa', parent: 'alimentari', icon: 'croissant', color: '#d97706' },
  { slug: 'pasta-cereali', name: 'Pasta, riso e cereali', domain: 'spesa', parent: 'alimentari', icon: 'wheat', color: '#ca8a04' },
  { slug: 'colazione-dolci', name: 'Colazione e dolci', domain: 'spesa', parent: 'alimentari', icon: 'cookie', color: '#c026d3' },
  { slug: 'conserve', name: 'Conserve e scatolame', domain: 'spesa', parent: 'alimentari', icon: 'archive', color: '#7c3aed' },
  { slug: 'surgelati', name: 'Surgelati', domain: 'spesa', parent: 'alimentari', icon: 'snowflake', color: '#38bdf8' },
  { slug: 'condimenti', name: 'Condimenti e spezie', domain: 'spesa', parent: 'alimentari', icon: 'droplets', color: '#84cc16' },
  { slug: 'snack', name: 'Snack e aperitivi', domain: 'spesa', parent: 'alimentari', icon: 'popcorn', color: '#f59e0b' },

  // ------------------------------------------------------------------ Bevande
  { slug: 'bevande', name: 'Bevande', domain: 'spesa', parent: null, icon: 'cup-soda', color: '#0891b2' },
  { slug: 'acqua', name: 'Acqua', domain: 'spesa', parent: 'bevande', icon: 'glass-water', color: '#22d3ee' },
  { slug: 'bibite', name: 'Bibite e succhi', domain: 'spesa', parent: 'bevande', icon: 'cup-soda', color: '#06b6d4' },
  { slug: 'alcolici', name: 'Vino e alcolici', domain: 'spesa', parent: 'bevande', icon: 'wine', color: '#9f1239' },
  { slug: 'caffe-te', name: 'Caffè e tè', domain: 'spesa', parent: 'bevande', icon: 'coffee', color: '#78350f' },

  // -------------------------------------------------------------- Casa e cura
  { slug: 'casa-pulizia', name: 'Casa e pulizia', domain: 'spesa', parent: null, icon: 'spray-can', color: '#6366f1' },
  { slug: 'detersivi', name: 'Detersivi', domain: 'spesa', parent: 'casa-pulizia', icon: 'spray-can', color: '#818cf8' },
  { slug: 'carta-casa', name: 'Carta e usa e getta', domain: 'spesa', parent: 'casa-pulizia', icon: 'scroll', color: '#a5b4fc' },
  { slug: 'cura-persona', name: 'Cura della persona', domain: 'spesa', parent: null, icon: 'sparkles', color: '#ec4899' },
  { slug: 'animali', name: 'Animali domestici', domain: 'spesa', parent: null, icon: 'paw-print', color: '#a16207' },
  { slug: 'spesa-altro', name: 'Altro (spesa)', domain: 'spesa', parent: null, icon: 'circle-help', color: '#94a3b8' },

  // ------------------------------------------------------------------- Utenze
  { slug: 'utenze', name: 'Utenze', domain: 'utenze', parent: null, icon: 'plug-zap', color: '#f97316' },
  { slug: 'energia-elettrica', name: 'Energia elettrica', domain: 'utenze', parent: 'utenze', icon: 'zap', color: '#facc15' },
  { slug: 'gas', name: 'Gas', domain: 'utenze', parent: 'utenze', icon: 'flame', color: '#fb923c' },
  { slug: 'acqua-utenza', name: 'Acqua', domain: 'utenze', parent: 'utenze', icon: 'droplet', color: '#38bdf8' },
  { slug: 'rifiuti', name: 'Rifiuti', domain: 'utenze', parent: 'utenze', icon: 'trash-2', color: '#84cc16' },
  { slug: 'telefonia', name: 'Telefonia mobile', domain: 'utenze', parent: 'utenze', icon: 'smartphone', color: '#8b5cf6' },
  { slug: 'internet', name: 'Internet e fisso', domain: 'utenze', parent: 'utenze', icon: 'wifi', color: '#3b82f6' },

  // --------------------------------------------------------------------- Casa
  { slug: 'abitazione', name: 'Abitazione', domain: 'casa', parent: null, icon: 'house', color: '#0d9488' },
  { slug: 'affitto-mutuo', name: 'Affitto o mutuo', domain: 'casa', parent: 'abitazione', icon: 'key', color: '#14b8a6' },
  { slug: 'condominio', name: 'Spese condominiali', domain: 'casa', parent: 'abitazione', icon: 'building', color: '#2dd4bf' },
  { slug: 'manutenzione-casa', name: 'Manutenzione', domain: 'casa', parent: 'abitazione', icon: 'wrench', color: '#5eead4' },
  { slug: 'arredamento', name: 'Arredamento', domain: 'casa', parent: 'abitazione', icon: 'lamp', color: '#99f6e4' },

  // ---------------------------------------------------------------- Trasporti
  { slug: 'trasporti', name: 'Trasporti', domain: 'trasporti', parent: null, icon: 'car', color: '#475569' },
  { slug: 'carburante', name: 'Carburante', domain: 'trasporti', parent: 'trasporti', icon: 'fuel', color: '#64748b' },
  { slug: 'assicurazione-auto', name: 'Assicurazione e bollo', domain: 'trasporti', parent: 'trasporti', icon: 'shield', color: '#94a3b8' },
  { slug: 'manutenzione-auto', name: 'Manutenzione veicolo', domain: 'trasporti', parent: 'trasporti', icon: 'wrench', color: '#cbd5e1' },
  { slug: 'trasporto-pubblico', name: 'Trasporto pubblico', domain: 'trasporti', parent: 'trasporti', icon: 'bus', color: '#334155' },

  // ------------------------------------------------------------------- Salute
  { slug: 'salute', name: 'Salute', domain: 'salute', parent: null, icon: 'heart-pulse', color: '#e11d48' },
  { slug: 'farmaci', name: 'Farmaci e parafarmacia', domain: 'salute', parent: 'salute', icon: 'pill', color: '#f43f5e' },
  { slug: 'visite', name: 'Visite ed esami', domain: 'salute', parent: 'salute', icon: 'stethoscope', color: '#fb7185' },

  // -------------------------------------------------------------- Tempo libero
  { slug: 'tempo-libero', name: 'Tempo libero', domain: 'tempo_libero', parent: null, icon: 'party-popper', color: '#a855f7' },
  { slug: 'ristoranti', name: 'Ristoranti e bar', domain: 'tempo_libero', parent: 'tempo-libero', icon: 'utensils', color: '#c084fc' },
  { slug: 'abbonamenti', name: 'Abbonamenti digitali', domain: 'tempo_libero', parent: 'tempo-libero', icon: 'monitor-play', color: '#d8b4fe' },
  { slug: 'viaggi', name: 'Viaggi', domain: 'tempo_libero', parent: 'tempo-libero', icon: 'plane', color: '#e9d5ff' },
  { slug: 'sport-cultura', name: 'Sport e cultura', domain: 'tempo_libero', parent: 'tempo-libero', icon: 'dumbbell', color: '#f0abfc' },

  // -------------------------------------------------------------------- Altro
  { slug: 'non-categorizzato', name: 'Da categorizzare', domain: 'altro', parent: null, icon: 'circle-help', color: '#94a3b8' },
];

/** Slug della categoria di fallback. Le righe che finiscono qui vanno mostrate, non nascoste. */
export const UNCATEGORIZED_SLUG = 'non-categorizzato';

const BY_SLUG = new Map(SEED_CATEGORIES.map((c) => [c.slug, c] as const));

export function findSeedCategory(slug: string): SeedCategory | undefined {
  return BY_SLUG.get(slug);
}

/** Catena dalla radice alla categoria indicata, utile per i breadcrumb e i raggruppamenti. */
export function categoryPath(slug: string): SeedCategory[] {
  const path: SeedCategory[] = [];
  let current = BY_SLUG.get(slug);
  const guard = new Set<string>();
  while (current && !guard.has(current.slug)) {
    guard.add(current.slug);
    path.unshift(current);
    current = current.parent ? BY_SLUG.get(current.parent) : undefined;
  }
  return path;
}

/** Categoria radice di appartenenza: è il livello a cui si aggregano i grafici principali. */
export function rootCategory(slug: string): SeedCategory | undefined {
  return categoryPath(slug)[0];
}
