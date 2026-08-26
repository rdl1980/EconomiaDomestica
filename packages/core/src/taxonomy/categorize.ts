/**
 * Categorizzazione automatica di una riga di scontrino.
 *
 * Ordine di affidabilità:
 *   1. categoria del prodotto già a catalogo   (l'utente l'ha decisa una volta)
 *   2. regole per parole chiave sulla descrizione
 *   3. suggerimento arrivato dalla sorgente di estrazione (`category_hint`)
 *   4. "Da categorizzare"
 *
 * Il livello 4 non è un fallimento: è un dato onesto. Una riga senza categoria si
 * vede in dashboard e si corregge; una riga messa nella categoria sbagliata falsa
 * i grafici in silenzio.
 */

import { normalizeDescription } from '../matching/normalize';
import { UNCATEGORIZED_SLUG, findSeedCategory } from './categories';

export interface CategoryRule {
  slug: string;
  /** Parole intere, già normalizzate (minuscole, senza accenti). */
  keywords: readonly string[];
}

/**
 * Vince la parola chiave più lunga fra quelle che matchano (vedi `matchByRules`),
 * non la prima dell'elenco. L'ordine delle regole conta solo a parità di
 * lunghezza. Aggiungendo una parola chiave, la domanda giusta è quindi "è più
 * specifica delle altre che potrebbero matchare la stessa descrizione?".
 */
export const CATEGORY_RULES: readonly CategoryRule[] = [
  { slug: 'detersivi', keywords: ['detersivo', 'detergente', 'ammorbidente', 'candeggina', 'sgrassatore', 'anticalcare', 'lavastoviglie', 'brillantante', 'sapone piatti', 'svelto', 'lysoform', 'cif', 'dash', 'dixan', 'lenor'] },
  { slug: 'carta-casa', keywords: ['carta igienica', 'igienica', 'tovaglioli', 'scottex', 'asciugatutto', 'pellicola', 'alluminio', 'sacchi', 'sacchetti', 'spugne', 'guanti'] },
  { slug: 'cura-persona', keywords: ['shampoo', 'balsamo', 'bagnoschiuma', 'doccia', 'dentifricio', 'spazzolino', 'collutorio', 'deodorante', 'rasoio', 'schiuma barba', 'assorbenti', 'pannolini', 'crema viso', 'cotton', 'salviette'] },
  { slug: 'animali', keywords: ['gatto', 'gatti', 'cane', 'cani', 'crocchette', 'lettiera', 'whiskas', 'friskies', 'pedigree'] },

  { slug: 'ortofrutta', keywords: ['mela', 'mele', 'pera', 'pere', 'banana', 'banane', 'arancia', 'arance', 'limone', 'limoni', 'mandarini', 'clementine', 'uva', 'pesche', 'albicocche', 'fragole', 'ciliegie', 'melone', 'anguria', 'kiwi', 'ananas', 'pomodoro', 'pomodori', 'ciliegino', 'datterini', 'insalata', 'lattuga', 'rucola', 'spinaci', 'zucchine', 'melanzane', 'peperoni', 'carote', 'patate', 'cipolla', 'cipolle', 'aglio', 'sedano', 'finocchi', 'broccoli', 'cavolfiore', 'verza', 'zucca', 'funghi', 'fagiolini', 'piselli freschi', 'frutta', 'verdura'] },
  { slug: 'carne', keywords: ['pollo', 'petto pollo', 'tacchino', 'manzo', 'vitello', 'maiale', 'macinato', 'hamburger', 'salsiccia', 'salsicce', 'bistecca', 'fettine', 'arrosto', 'costine', 'agnello', 'coniglio'] },
  { slug: 'pesce', keywords: ['pesce', 'salmone', 'tonno fresco', 'merluzzo', 'orata', 'branzino', 'gamberi', 'gamberetti', 'calamari', 'cozze', 'vongole', 'platessa', 'baccala', 'alici'] },
  { slug: 'salumi', keywords: ['prosciutto', 'crudo', 'cotto', 'salame', 'mortadella', 'speck', 'bresaola', 'pancetta', 'guanciale', 'wurstel', 'coppa', 'porchetta'] },
  { slug: 'latticini', keywords: ['latte', 'yogurt', 'burro', 'panna', 'mozzarella', 'formaggio', 'parmigiano', 'grana', 'reggiano', 'pecorino', 'ricotta', 'stracchino', 'gorgonzola', 'philadelphia', 'mascarpone', 'uova', 'uovo', 'emmental', 'scamorza', 'provola', 'caciotta', 'fontina', 'asiago'] },
  { slug: 'panetteria', keywords: ['pane', 'panino', 'panini', 'baguette', 'ciabatta', 'focaccia', 'piadina', 'grissini', 'crackers', 'fette biscottate', 'pancarre', 'tramezzino', 'pizza bianca'] },
  { slug: 'pasta-cereali', keywords: ['pasta', 'spaghetti', 'penne', 'fusilli', 'rigatoni', 'riso', 'farro', 'orzo', 'cous cous', 'quinoa', 'farina', 'semola', 'gnocchi', 'tortellini', 'ravioli', 'lasagne', 'barilla', 'divella', 'rummo'] },
  { slug: 'colazione-dolci', keywords: ['biscotti', 'brioche', 'cornetti', 'merendine', 'cereali', 'fette', 'marmellata', 'confettura', 'miele', 'nutella', 'crema spalmabile', 'cioccolato', 'cioccolata', 'torta', 'budino', 'gelato', 'zucchero', 'caramelle', 'dolce'] },
  { slug: 'conserve', keywords: ['passata', 'pelati', 'polpa pomodoro', 'concentrato', 'tonno', 'sgombro', 'legumi', 'fagioli', 'ceci', 'lenticchie', 'piselli', 'mais', 'olive', 'sottaceti', 'sottoli', 'brodo', 'dado', 'zuppa'] },
  { slug: 'surgelati', keywords: ['surgelat', 'bastoncini', 'minestrone', 'gelato', 'ghiaccio', 'findus'] },
  { slug: 'condimenti', keywords: ['olio', 'extravergine', 'aceto', 'sale', 'pepe', 'spezie', 'origano', 'basilico', 'maionese', 'ketchup', 'senape', 'pesto', 'sugo', 'ragu'] },
  { slug: 'snack', keywords: ['patatine', 'chips', 'taralli', 'noccioline', 'arachidi', 'pistacchi', 'mandorle', 'noci', 'popcorn', 'salatini', 'pringles', 'frutta secca'] },

  { slug: 'acqua', keywords: ['acqua', 'naturale', 'frizzante', 'levissima', 'sant anna', 'ferrarelle', 'san benedetto', 'lete', 'uliveto'] },
  { slug: 'caffe-te', keywords: ['caffe', 'cialde', 'capsule', 'the', 'tisana', 'camomilla', 'lavazza', 'illy', 'nespresso'] },
  { slug: 'alcolici', keywords: ['vino', 'birra', 'prosecco', 'spumante', 'rosso', 'bianco', 'amaro', 'grappa', 'liquore', 'gin', 'vodka', 'rum', 'whisky', 'aperol', 'campari'] },
  { slug: 'bibite', keywords: ['coca', 'cola', 'fanta', 'sprite', 'aranciata', 'chinotto', 'succo', 'succhi', 'estathe', 'gatorade', 'redbull', 'energy', 'succo di frutta', 'succhi di frutta'] },

  { slug: 'farmaci', keywords: ['farmac', 'tachipirina', 'moment', 'aspirina', 'oki', 'cerotti', 'integratore', 'vitamina', 'sciroppo', 'antibiotico'] },
  { slug: 'carburante', keywords: ['benzina', 'gasolio', 'diesel', 'gpl', 'metano', 'rifornimento', 'carburante'] },
];

export interface CategorizationInput {
  rawDescription: string;
  /** Categoria del prodotto già a catalogo, se la riga è stata agganciata. */
  productCategorySlug?: string | null;
  /** Suggerimento dalla sorgente di estrazione. */
  hint?: string | null;
}

export interface CategorizationResult {
  slug: string;
  /** Da dove arriva la decisione: serve a mostrare all'utente perché. */
  source: 'product' | 'rule' | 'hint' | 'fallback';
  /** Parola chiave che ha fatto scattare la regola, quando applicabile. */
  matchedKeyword?: string;
}

/** Lunghezza minima perché una parola chiave valga anche come prefisso. */
const PREFIX_MIN_LENGTH = 6;

/**
 * Vince la parola chiave **più lunga**, non la prima regola dell'elenco.
 *
 * Il motivo si vede su un caso reale: "PISELLI SURGELAT" contiene sia `piselli`
 * (conserve) sia `surgelat` (surgelati), e la risposta giusta è surgelati. La
 * lunghezza è un'approssimazione grezza della specificità, ma funziona bene su
 * questo dominio e resta prevedibile: a parità di lunghezza decide l'ordine
 * delle regole.
 */
function matchByRules(normalized: string): { slug: string; keyword: string } | null {
  const tokens = normalized.split(' ').filter(Boolean);
  let best: { slug: string; keyword: string } | null = null;

  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      let hit: boolean;
      if (keyword.includes(' ')) {
        // Chiavi composte: match su sottostringa, sono già specifiche di loro.
        hit = normalized.includes(keyword);
      } else {
        // Chiavi semplici: parola intera, oppure prefisso se la chiave è lunga.
        // Serve per le forme troncate degli scontrini ("SURGELAT", "FARMAC"),
        // senza aprire a match casuali su parole corte.
        hit = tokens.some(
          (token) =>
            token === keyword ||
            (keyword.length >= PREFIX_MIN_LENGTH && token.startsWith(keyword)),
        );
      }

      if (hit && (best === null || keyword.length > best.keyword.length)) {
        best = { slug: rule.slug, keyword };
      }
    }
  }

  return best;
}

export function categorizeLine(input: CategorizationInput): CategorizationResult {
  if (input.productCategorySlug && findSeedCategory(input.productCategorySlug)) {
    return { slug: input.productCategorySlug, source: 'product' };
  }
  // Una categoria custom dell'household non sta nel seed ma resta valida.
  if (input.productCategorySlug) {
    return { slug: input.productCategorySlug, source: 'product' };
  }

  const normalized = normalizeDescription(input.rawDescription);
  const ruled = matchByRules(normalized);
  if (ruled) {
    return { slug: ruled.slug, source: 'rule', matchedKeyword: ruled.keyword };
  }

  if (input.hint) {
    const hintSlug = normalizeDescription(input.hint).replace(/ /g, '-');
    if (findSeedCategory(hintSlug)) {
      return { slug: hintSlug, source: 'hint' };
    }
    const byName = CATEGORY_RULES.find((r) => r.slug === hintSlug);
    if (byName) return { slug: byName.slug, source: 'hint' };
  }

  return { slug: UNCATEGORIZED_SLUG, source: 'fallback' };
}
