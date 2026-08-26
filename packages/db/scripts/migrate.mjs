#!/usr/bin/env node
/**
 * Migration runner.
 *
 * Volutamente minimale: applica in ordine i file .sql della cartella migrations,
 * ciascuno dentro una transazione, e registra nome e checksum in
 * `schema_migrations`.
 *
 * Il checksum serve a intercettare la modifica di una migration già applicata:
 * è l'errore che, in un progetto a più ambienti, produce database divergenti
 * senza che nessuno se ne accorga.
 *
 *   node scripts/migrate.mjs            applica le migration mancanti
 *   node scripts/migrate.mjs --status   mostra cosa è stato applicato
 *   node scripts/migrate.mjs --dry-run  elenca cosa verrebbe applicato
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', 'migrations');
const REPO_ROOT = resolve(HERE, '..', '..', '..');

/** Carica le variabili da .env.local senza dipendenze esterne. */
async function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const path = join(REPO_ROOT, name);
    if (!existsSync(path)) continue;
    const content = await readFile(path, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
}

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex').slice(0, 16);
}

async function listMigrations() {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const out = [];
  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    out.push({ file, sql, checksum: checksum(sql) });
  }
  return out;
}

async function ensureTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      file        text primary key,
      checksum    text not null,
      applied_at  timestamptz not null default now()
    )
  `);
}

async function main() {
  await loadEnv();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      'DATABASE_URL non impostata.\n' +
        'Compilala in .env.local con la connection string del progetto Supabase.',
    );
    process.exit(1);
  }

  const status = process.argv.includes('--status');
  const dryRun = process.argv.includes('--dry-run');

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    // Il pooler di Supabase chiude le connessioni inattive: teniamo i tempi stretti.
    connectionTimeoutMillis: 20_000,
    statement_timeout: 120_000,
  });

  await client.connect();
  try {
    await ensureTable(client);
    const { rows: applied } = await client.query(
      'select file, checksum, applied_at from schema_migrations order by file',
    );
    const appliedByFile = new Map(applied.map((r) => [r.file, r]));
    const migrations = await listMigrations();

    if (status) {
      for (const m of migrations) {
        const row = appliedByFile.get(m.file);
        if (!row) {
          console.log(`  [ ] ${m.file}`);
        } else if (row.checksum !== m.checksum) {
          console.log(`  [!] ${m.file}  MODIFICATA DOPO L'APPLICAZIONE`);
        } else {
          console.log(`  [x] ${m.file}  ${new Date(row.applied_at).toISOString().slice(0, 19)}`);
        }
      }
      return;
    }

    for (const m of migrations) {
      const row = appliedByFile.get(m.file);
      if (row) {
        if (row.checksum !== m.checksum) {
          throw new Error(
            `La migration ${m.file} è già stata applicata ma il file è cambiato.\n` +
              'Non modificare una migration applicata: creane una nuova.',
          );
        }
        continue;
      }

      if (dryRun) {
        console.log(`  da applicare: ${m.file}`);
        continue;
      }

      process.stdout.write(`  applico ${m.file} ... `);
      await client.query('begin');
      try {
        await client.query(m.sql);
        await client.query('insert into schema_migrations (file, checksum) values ($1, $2)', [
          m.file,
          m.checksum,
        ]);
        await client.query('commit');
        console.log('ok');
      } catch (err) {
        await client.query('rollback');
        console.log('FALLITA');
        throw err;
      }
    }

    if (!dryRun) console.log('Migration completate.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  if (err.detail) console.error(err.detail);
  if (err.hint) console.error(`Suggerimento: ${err.hint}`);
  if (err.position) console.error(`Posizione nel file SQL: ${err.position}`);
  process.exit(1);
});
