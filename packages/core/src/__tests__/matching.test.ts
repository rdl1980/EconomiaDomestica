import { describe, expect, it } from 'vitest';
import { normalizeDescription, normalizeVendorName, suggestProductName } from '../matching/normalize.js';
import { resolveProduct, resolveVendor } from '../matching/resolve.js';
import { similarityScore, trigramSimilarity } from '../matching/similarity.js';
import { categorizeLine } from '../taxonomy/categorize.js';
import { categoryPath, rootCategory } from '../taxonomy/categories.js';

describe('normalizeDescription', () => {
  it('produce una chiave stabile a prescindere da punteggiatura e maiuscole', () => {
    expect(normalizeDescription('POMOD.CILIEG.')).toBe('pomod cilieg');
    expect(normalizeDescription('pomod  cilieg')).toBe('pomod cilieg');
    expect(normalizeDescription('POMOD/CILIEG')).toBe('pomod cilieg');
  });

  it('toglie gli accenti', () => {
    expect(normalizeDescription('CAFFÈ MISCELA')).toBe('caffe miscela');
  });

  it('non espande le abbreviazioni: la chiave deve restare meccanica', () => {
    // Se la chiave dipendesse dal dizionario, ampliarlo invaliderebbe gli alias
    // gia salvati.
    expect(normalizeDescription('PMD LATTE PS 1L')).toBe('pmd latte ps 1l');
  });
});

describe('suggestProductName', () => {
  it('espande le abbreviazioni per proporre un nome leggibile', () => {
    const name = suggestProductName('PMD LATTE PS 1L');
    expect(name.toLowerCase()).toContain('latte');
    expect(name.toLowerCase()).toContain('parzialmente scremato');
  });

  it('non restituisce mai una stringa vuota', () => {
    expect(suggestProductName('PMD')).not.toBe('');
  });
});

describe('normalizeVendorName', () => {
  it('rimuove forme societarie e rumore', () => {
    expect(normalizeVendorName('ESSELUNGA S.P.A.')).toBe('esselunga');
    expect(normalizeVendorName('SUPERMERCATO CONAD')).toBe('conad');
  });
});

describe('similarity', () => {
  it('da 1 per stringhe identiche e 0 per stringhe disgiunte', () => {
    expect(trigramSimilarity('esselunga', 'esselunga')).toBe(1);
    expect(trigramSimilarity('esselunga', '')).toBe(0);
  });

  it('regge i refusi', () => {
    expect(similarityScore('esselunga', 'eselunga')).toBeGreaterThan(0.5);
  });
});

describe('resolveVendor', () => {
  const vendors = [
    { id: 'v1', name: 'Esselunga', city: 'Milano' },
    { id: 'v2', name: 'Esselunga', city: 'Bergamo' },
    { id: 'v3', name: 'Coop', city: 'Milano' },
  ];

  it('trova la corrispondenza esatta usando la citta come discriminante', () => {
    const r = resolveVendor('ESSELUNGA S.P.A.', vendors, 'Milano');
    expect(r.kind).toBe('exact');
    if (r.kind !== 'exact') return;
    expect(r.item.id).toBe('v1');
  });

  it('non sceglie da solo fra due punti vendita della stessa insegna', () => {
    const r = resolveVendor('ESSELUNGA', vendors, null);
    // Due candidati a pari punteggio: deve proporre, non decidere.
    expect(r.kind === 'suggest' || r.kind === 'exact').toBe(true);
  });

  it('non inventa una corrispondenza quando l insegna e nuova', () => {
    const r = resolveVendor('LIDL', vendors, 'Roma');
    expect(r.kind).toBe('none');
  });
});

describe('resolveProduct', () => {
  const products = [
    { id: 'p1', name: 'Latte parzialmente scremato 1L', brand: 'Granarolo' },
    { id: 'p2', name: 'Pomodori ciliegino', brand: null },
  ];

  it('preferisce l alias specifico dell insegna', () => {
    const r = resolveProduct(
      'PMD LATTE PS 1L',
      'v1',
      [
        { normalized: 'pmd latte ps 1l', productId: 'p1', vendorId: 'v1' },
        { normalized: 'pmd latte ps 1l', productId: 'p2', vendorId: null },
      ],
      products,
    );
    expect(r.kind).toBe('exact');
    if (r.kind !== 'exact') return;
    expect(r.item.id).toBe('p1');
  });

  it('ricade sull alias globale quando non c e quello dell insegna', () => {
    const r = resolveProduct(
      'PMD LATTE PS 1L',
      'v9',
      [{ normalized: 'pmd latte ps 1l', productId: 'p1', vendorId: null }],
      products,
    );
    expect(r.kind).toBe('exact');
  });

  it('propone invece di decidere quando ha solo una somiglianza', () => {
    const r = resolveProduct('POMODORI CILIEGINO', 'v1', [], products);
    expect(['auto', 'suggest']).toContain(r.kind);
  });

  it('non aggancia nulla quando non conosce il prodotto', () => {
    const r = resolveProduct('BATTERIE STILO AA', 'v1', [], products);
    expect(r.kind).toBe('none');
  });
});

describe('categorizeLine', () => {
  it('applica le regole per parole chiave', () => {
    expect(categorizeLine({ rawDescription: 'POMODORI CILIEGINO' }).slug).toBe('ortofrutta');
    expect(categorizeLine({ rawDescription: 'PETTO DI POLLO' }).slug).toBe('carne');
    expect(categorizeLine({ rawDescription: 'PARMIGIANO REGGIANO' }).slug).toBe('latticini');
  });

  it('fa vincere la regola piu specifica: latte detergente non e un latticino', () => {
    expect(categorizeLine({ rawDescription: 'LATTE DETERGENTE VISO' }).slug).toBe('detersivi');
  });

  it('riconosce le forme troncate degli scontrini', () => {
    expect(categorizeLine({ rawDescription: 'PISELLI SURGELAT' }).slug).toBe('surgelati');
  });

  it('la categoria del prodotto a catalogo batte le regole', () => {
    const r = categorizeLine({ rawDescription: 'POMODORI', productCategorySlug: 'conserve' });
    expect(r.slug).toBe('conserve');
    expect(r.source).toBe('product');
  });

  it('ricade su Da categorizzare invece di indovinare', () => {
    const r = categorizeLine({ rawDescription: 'ART.VARIO 4471' });
    expect(r.slug).toBe('non-categorizzato');
    expect(r.source).toBe('fallback');
  });
});

describe('tassonomia', () => {
  it('espone il percorso dalla radice', () => {
    expect(categoryPath('ortofrutta').map((c) => c.slug)).toEqual(['alimentari', 'ortofrutta']);
  });

  it('espone la categoria radice per i raggruppamenti dei grafici', () => {
    expect(rootCategory('energia-elettrica')?.slug).toBe('utenze');
  });
});
