#!/usr/bin/env node
/**
 * Esegue tutte le migration su un Postgres vero, in memoria (PGlite, WASM).
 *
 * Perché esiste: le migration girano una volta sola, su un database che spesso
 * non è raggiungibile dalla macchina di chi le scrive. Un errore di sintassi in
 * ottocento righe di SQL si scopre altrimenti solo al primo deploy, a metà
 * strada, con lo schema già mezzo applicato.
 *
 * Cosa NON verifica: il comportamento della RLS con un utente reale, e la
 * corrispondenza esatta con i servizi Supabase — `auth` e `storage` qui sono
 * finti, quel tanto che basta perché le migration si applichino. Verifica
 * sintassi, dipendenze fra oggetti, tipi delle funzioni e coerenza dei vincoli.
 *
 *   node scripts/check-migrations.mjs
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', 'migrations');

/**
 * Finti servizi Supabase.
 * Solo la superficie che le migration toccano: lo schema auth con la tabella
 * users e uid(), lo schema storage con buckets/objects e foldername(), e i
 * ruoli a cui si concedono i permessi.
 */
const SUPABASE_SHIM = `
create schema if not exists auth;
create schema if not exists storage;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end $$;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text not null,
  owner     uuid
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(name, '/')
$$;
`;

/** Smoke test: lo schema regge un giro completo di dati veri. */
const SMOKE = `
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'test@example.com');

insert into household (id, name) values
  ('22222222-2222-2222-2222-222222222222', 'Casa di prova');

insert into member (household_id, user_id, display_name, role) values
  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111', 'Tester', 'owner');

insert into vendor (id, household_id, name, type) values
  ('33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'Esselunga', 'supermercato');

insert into product (id, household_id, name, default_unit) values
  ('44444444-4444-4444-4444-444444444444',
   '22222222-2222-2222-2222-222222222222', 'Latte PS 1L', 'pcs');

insert into transaction (id, household_id, vendor_id, occurred_at, total_amount) values
  ('55555555-5555-5555-5555-555555555555',
   '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333',
   now() - interval '3 days', 12.44);

insert into line_item
  (household_id, transaction_id, line_no, raw_description, product_id, category_id,
   quantity, unit, unit_price, gross_amount, net_amount)
values
  ('22222222-2222-2222-2222-222222222222',
   '55555555-5555-5555-5555-555555555555', 1, 'PMD LATTE PS 1L',
   '44444444-4444-4444-4444-444444444444',
   (select id from category where slug = 'latticini' and household_id is null),
   2, 'pcs', 1.29, 2.58, 2.58);

insert into price_observation
  (household_id, product_id, vendor_id, observed_on, normalized_unit, unit_price_normalized)
values
  ('22222222-2222-2222-2222-222222222222',
   '44444444-4444-4444-4444-444444444444',
   '33333333-3333-3333-3333-333333333333',
   current_date - 3, 'l', 1.29);

insert into utility_contract (id, household_id, type, name, consumption_unit) values
  ('66666666-6666-6666-6666-666666666666',
   '22222222-2222-2222-2222-222222222222', 'energia_elettrica', 'Luce casa', 'kWh');
`;

/** Query di verifica: nome -> [sql, controllo sul risultato]. */
const CHECKS = [
  [
    'seed categorie applicato',
    `select count(*)::int as n from category where household_id is null`,
    (rows) => (rows[0].n >= 50 ? null : `attese >= 50 categorie, trovate ${rows[0].n}`),
  ],
  [
    'gerarchia categorie collegata',
    `select count(*)::int as n from category where parent_id is not null and household_id is null`,
    (rows) => (rows[0].n >= 30 ? null : `attesi >= 30 collegamenti padre-figlio, trovati ${rows[0].n}`),
  ],
  [
    'vista v_expense_line interrogabile',
    `select count(*)::int as n from v_expense_line
      where household_id = '22222222-2222-2222-2222-222222222222'`,
    (rows) => (rows[0].n === 1 ? null : `attesa 1 riga, trovate ${rows[0].n}`),
  ],
  [
    'v_expense_line risale alla categoria radice',
    `select root_category_slug from v_expense_line limit 1`,
    (rows) =>
      rows[0].root_category_slug === 'alimentari'
        ? null
        : `attesa radice alimentari, trovata ${rows[0].root_category_slug}`,
  ],
  [
    'dashboard_summary',
    `select * from dashboard_summary('22222222-2222-2222-2222-222222222222',
       now() - interval '30 days', now() + interval '1 day')`,
    (rows) => (Number(rows[0].total) === 12.44 ? null : `totale inatteso: ${rows[0].total}`),
  ],
  [
    'spend_by_category',
    `select * from spend_by_category('22222222-2222-2222-2222-222222222222',
       now() - interval '30 days', now() + interval '1 day')`,
    (rows) => (rows.length === 1 ? null : `attesa 1 categoria, trovate ${rows.length}`),
  ],
  [
    'spend_by_vendor',
    `select * from spend_by_vendor('22222222-2222-2222-2222-222222222222',
       now() - interval '30 days', now() + interval '1 day')`,
    (rows) => (rows.length === 1 ? null : `attesa 1 insegna, trovate ${rows.length}`),
  ],
  [
    'spend_by_month genera i mesi vuoti',
    `select * from spend_by_month('22222222-2222-2222-2222-222222222222', 12)`,
    (rows) => (rows.length === 12 ? null : `attesi 12 mesi, trovati ${rows.length}`),
  ],
  [
    'top_products',
    `select * from top_products('22222222-2222-2222-2222-222222222222',
       now() - interval '30 days', now() + interval '1 day', 10)`,
    (rows) => (rows.length === 1 ? null : `atteso 1 prodotto, trovati ${rows.length}`),
  ],
  [
    'product_price_summary',
    `select * from product_price_summary('22222222-2222-2222-2222-222222222222',
       current_date - 30, current_date + 1, 10)`,
    (rows) => (rows.length === 1 ? null : `atteso 1 prodotto, trovati ${rows.length}`),
  ],
  [
    'product_price_history',
    `select * from product_price_history('22222222-2222-2222-2222-222222222222',
       '44444444-4444-4444-4444-444444444444')`,
    (rows) => (rows.length === 1 ? null : `attesa 1 rilevazione, trovate ${rows.length}`),
  ],
  [
    'product_price_by_vendor',
    `select * from product_price_by_vendor('22222222-2222-2222-2222-222222222222',
       '44444444-4444-4444-4444-444444444444')`,
    (rows) => (rows.length === 1 ? null : `attesa 1 insegna, trovate ${rows.length}`),
  ],
  [
    'personal_inflation',
    `select * from personal_inflation('22222222-2222-2222-2222-222222222222', 12)`,
    (rows) => (rows.length === 12 ? null : `attesi 12 mesi, trovati ${rows.length}`),
  ],
  [
    'real_deals (nessuna con una sola rilevazione)',
    `select * from real_deals('22222222-2222-2222-2222-222222222222', 4, 10)`,
    (rows) => (rows.length === 0 ? null : `attese 0 offerte, trovate ${rows.length}`),
  ],
  [
    'product_catalog',
    `select * from product_catalog('22222222-2222-2222-2222-222222222222')`,
    (rows) => (rows.length === 1 ? null : `atteso 1 prodotto, trovati ${rows.length}`),
  ],
  [
    'utility_series (nessuna bolletta)',
    `select * from utility_series('22222222-2222-2222-2222-222222222222',
       '66666666-6666-6666-6666-666666666666')`,
    (rows) => (rows.length === 0 ? null : `attese 0 bollette, trovate ${rows.length}`),
  ],
  [
    'utility_decomposition (serve una serie)',
    `select * from utility_decomposition('22222222-2222-2222-2222-222222222222',
       '66666666-6666-6666-6666-666666666666')`,
    (rows) => (rows.length === 0 ? null : `attese 0 righe, trovate ${rows.length}`),
  ],
  [
    'RLS attiva su tutte le tabelle con household_id',
    `select string_agg(c.relname, ', ') as missing
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname <> 'schema_migrations'
        and not c.relrowsecurity`,
    (rows) => (rows[0].missing === null ? null : `RLS mancante su: ${rows[0].missing}`),
  ],
];

async function main() {
  const db = await PGlite.create({ extensions: { pg_trgm, pgcrypto } });

  console.log('Postgres in memoria pronto.\n');
  await db.exec(SUPABASE_SHIM);

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  let failures = 0;

  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`  ${file} ... `);
    try {
      await db.exec(sql);
      console.log('ok');
    } catch (error) {
      console.log('FALLITA');
      console.error(`\n    ${error.message}\n`);
      failures += 1;
      break; // le successive dipendono da questa
    }
  }

  if (failures > 0) {
    console.error('\nMigration non applicabili.');
    process.exit(1);
  }

  console.log('\nDati di prova e verifiche:');
  try {
    await db.exec(SMOKE);
  } catch (error) {
    console.error(`  inserimento dati di prova FALLITO: ${error.message}`);
    process.exit(1);
  }

  for (const [name, sql, verify] of CHECKS) {
    try {
      const result = await db.query(sql);
      const problem = verify(result.rows);
      if (problem) {
        console.log(`  [FAIL] ${name}: ${problem}`);
        failures += 1;
      } else {
        console.log(`  [ok]   ${name}`);
      }
    } catch (error) {
      console.log(`  [FAIL] ${name}: ${error.message}`);
      failures += 1;
    }
  }

  await db.close();

  if (failures > 0) {
    console.error(`\n${failures} verifiche fallite.`);
    process.exit(1);
  }
  console.log('\nSchema valido.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
