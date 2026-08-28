#!/usr/bin/env node
/**
 * Verifica che la Row Level Security isoli davvero due household diversi.
 *
 * Perché serve un test dedicato: la RLS è l'unica cosa che impedisce a una
 * famiglia di vedere la spesa di un'altra. Se una policy è sbagliata non si
 * rompe niente — semplicemente compaiono dati che non dovrebbero esserci, e
 * nessun test funzionale se ne accorge.
 *
 * Come funziona: simula ciò che fa PostgREST, cioè assume il ruolo
 * `authenticated` e imposta i claim JWT dell'utente. Tutto avviene dentro una
 * transazione che termina con ROLLBACK: sul database non resta nulla, nemmeno
 * gli utenti di prova.
 *
 *   node scripts/check-rls.mjs
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

async function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const path = join(REPO_ROOT, name);
    if (!existsSync(path)) continue;
    const content = await readFile(path, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, value] = match;
      if (!process.env[key]) process.env[key] = value.replace(/^["']|["']$/g, '');
    }
  }
}

const ALICE = '11111111-aaaa-4aaa-8aaa-111111111111';
const BOB = '22222222-bbbb-4bbb-8bbb-222222222222';

/** Impersona un utente come farebbe PostgREST. */
async function asUser(client, userId, sql) {
  await client.query(`set local role authenticated`);
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  const result = await client.query(sql);
  await client.query('reset role');
  return result.rows;
}

async function main() {
  await loadEnv();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL non impostata.');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();

  let failures = 0;
  const check = (name, condition, detail) => {
    if (condition) {
      console.log(`  [ok]   ${name}`);
    } else {
      console.log(`  [FAIL] ${name}${detail ? `: ${detail}` : ''}`);
      failures += 1;
    }
  };

  await client.query('begin');
  try {
    // --- due famiglie distinte, nessuna relazione fra loro --------------------
    await client.query(
      `insert into auth.users (id, email, instance_id, aud, role)
       values ($1, 'alice@test.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
              ($2, 'bob@test.invalid',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')`,
      [ALICE, BOB],
    );

    const [{ id: houseA }] = (
      await asUser(client, ALICE, `select create_household('Casa Alice', 'Alice') as id`)
    );
    const [{ id: houseB }] = (
      await asUser(client, BOB, `select create_household('Casa Bob', 'Bob') as id`)
    );

    check('create_household crea due case distinte', houseA !== houseB);

    // Spesa di Alice.
    await client.query(
      `insert into vendor (id, household_id, name, type)
       values ('33333333-cccc-4ccc-8ccc-333333333333', $1, 'Esselunga', 'supermercato')`,
      [houseA],
    );
    await client.query(
      `insert into transaction (id, household_id, vendor_id, occurred_at, total_amount)
       values ('44444444-dddd-4ddd-8ddd-444444444444', $1,
               '33333333-cccc-4ccc-8ccc-333333333333', now(), 42.00)`,
      [houseA],
    );

    // --- isolamento in lettura ----------------------------------------------
    const aliceSees = await asUser(client, ALICE, `select count(*)::int n from transaction`);
    const bobSees = await asUser(client, BOB, `select count(*)::int n from transaction`);
    check('Alice vede la propria spesa', aliceSees[0].n === 1, `viste ${aliceSees[0].n}`);
    check('Bob NON vede la spesa di Alice', bobSees[0].n === 0, `viste ${bobSees[0].n}`);

    const bobVendors = await asUser(client, BOB, `select count(*)::int n from vendor`);
    check('Bob non vede le insegne di Alice', bobVendors[0].n === 0, `viste ${bobVendors[0].n}`);

    const bobMembers = await asUser(client, BOB, `select count(*)::int n from member`);
    check('Bob vede solo se stesso fra i membri', bobMembers[0].n === 1, `visti ${bobMembers[0].n}`);

    // --- isolamento in scrittura --------------------------------------------
    let writeBlocked = false;
    try {
      await client.query('savepoint attempt_write');
      await asUser(
        client,
        BOB,
        `insert into transaction (household_id, occurred_at, total_amount)
         values ('${houseA}', now(), 999)`,
      );
      await client.query('rollback to savepoint attempt_write');
    } catch {
      writeBlocked = true;
      await client.query('rollback to savepoint attempt_write');
      await client.query('reset role');
    }
    check('Bob non puo scrivere nella casa di Alice', writeBlocked);

    // --- le categorie di sistema restano condivise --------------------------
    const bobCategories = await asUser(
      client,
      BOB,
      `select count(*)::int n from category where household_id is null`,
    );
    check(
      'le categorie di sistema sono visibili a tutti',
      bobCategories[0].n >= 50,
      `viste ${bobCategories[0].n}`,
    );

    let systemCategoryProtected = false;
    try {
      await client.query('savepoint attempt_category');
      await asUser(
        client,
        BOB,
        `update category set name = 'Manomessa' where household_id is null and slug = 'alimentari'`,
      );
      const [{ n }] = await asUser(
        client,
        BOB,
        `select count(*)::int n from category where name = 'Manomessa'`,
      );
      systemCategoryProtected = n === 0;
      await client.query('rollback to savepoint attempt_category');
    } catch {
      systemCategoryProtected = true;
      await client.query('rollback to savepoint attempt_category');
      await client.query('reset role');
    }
    check('nessuno puo modificare le categorie di sistema', systemCategoryProtected);

    // --- l'invito e l'unico modo per entrare in una casa ---------------------
    const [{ code }] = await asUser(
      client,
      ALICE,
      `select create_household_invite('${houseA}', 'adult') as code`,
    );
    check('il codice invito ha il formato atteso', /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), code);

    await asUser(client, BOB, `select accept_household_invite('${code}')`);
    const bobAfterInvite = await asUser(client, BOB, `select count(*)::int n from transaction`);
    check(
      'dopo l invito Bob vede la spesa di Alice',
      bobAfterInvite[0].n === 1,
      `viste ${bobAfterInvite[0].n}`,
    );

    let reuseBlocked = false;
    try {
      await client.query('savepoint attempt_reuse');
      await asUser(client, BOB, `select accept_household_invite('${code}')`);
      await client.query('rollback to savepoint attempt_reuse');
    } catch {
      reuseBlocked = true;
      await client.query('rollback to savepoint attempt_reuse');
      await client.query('reset role');
    }
    check('un invito gia usato non si riusa', reuseBlocked);
  } finally {
    // Niente resta sul database: nemmeno gli utenti di prova.
    await client.query('rollback');
    await client.end();
  }

  if (failures > 0) {
    console.error(`\n${failures} verifiche fallite: la RLS non isola come dovrebbe.`);
    process.exit(1);
  }
  console.log('\nIsolamento fra household verificato.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
