#!/usr/bin/env node
/**
 * Genera la migration di seed delle categorie a partire da @ed/core.
 *
 * La tassonomia ha una sola fonte di verità (packages/core/src/taxonomy/
 * categories.ts) e da lì si deriva l'SQL. Trascrivere a mano cinquanta righe in
 * due posti diversi è il modo più sicuro per farle divergere.
 *
 * La migration generata va committata: il runner ne calcola il checksum e deve
 * trovare un file stabile.
 *
 *   node scripts/gen-seed-categories.mjs > migrations/0003_seed_categories.sql
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(HERE, '..', '..', 'core', 'src', 'taxonomy', 'categories.ts');

const text = await readFile(SOURCE, 'utf8');

// Le voci sono oggetti letterali su una riga sola: si estraggono con una regex
// invece di tirare dentro un parser TypeScript.
const entries = [...text.matchAll(
  /\{\s*slug:\s*'([^']+)',\s*name:\s*'([^']+)',\s*domain:\s*'([^']+)',\s*parent:\s*(null|'[^']+'),\s*icon:\s*'([^']+)',\s*color:\s*'([^']+)'\s*\}/g,
)].map((m, index) => ({
  slug: m[1],
  name: m[2],
  domain: m[3],
  parent: m[4] === 'null' ? null : m[4].slice(1, -1),
  icon: m[5],
  color: m[6],
  sort: (index + 1) * 10,
}));

if (entries.length === 0) {
  console.error('Nessuna categoria trovata: il formato di categories.ts è cambiato.');
  process.exit(1);
}

const q = (v) => (v === null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

const rows = entries
  .map((e) => `    (${q(e.slug)}, ${q(e.name)}, ${q(e.domain)}, ${q(e.parent)}, ${q(e.icon)}, ${q(e.color)}, ${e.sort})`)
  .join(',\n');

process.stdout.write(`-- =============================================================================
-- 0003 - Seed delle categorie di sistema (household_id null)
--
-- GENERATO da packages/db/scripts/gen-seed-categories.mjs a partire da
-- packages/core/src/taxonomy/categories.ts. Non modificare a mano: rigenera.
--
-- Sono ${entries.length} categorie, di sistema e condivise fra tutti gli household.
-- I domini oltre 'spesa' esistono già qui anche se i moduli corrispondenti
-- arrivano dopo: così la dashboard totale ha senso dal primo giorno.
-- =============================================================================

with seed (slug, name, domain, parent_slug, icon, color, sort_order) as (
  values
${rows}
)
insert into category (household_id, slug, name, domain, icon, color, sort_order, is_system)
select null, slug, name, domain, icon, color, sort_order, true
from seed
on conflict do nothing;

-- Secondo passaggio: gli slug diventano riferimenti.
update category child
set parent_id = parent.id
from category parent, (
  values
${entries
  .filter((e) => e.parent)
  .map((e) => `    (${q(e.slug)}, ${q(e.parent)})`)
  .join(',\n')}
) as rel (slug, parent_slug)
where child.slug = rel.slug
  and child.household_id is null
  and parent.slug = rel.parent_slug
  and parent.household_id is null;
`);
