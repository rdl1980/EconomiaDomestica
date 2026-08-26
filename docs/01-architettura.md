# 01 - Architettura

## Il principio portante

Il rischio numero uno di questo progetto e' costruire "un'app per scontrini" e poi
doverla riscrivere quando arrivano le bollette. Per evitarlo, il cuore dell'app non
e' lo scontrino: e' un **ledger domestico** con documenti allegati.

```
                 +--------------- CORE (stabile) ----------------+
                 |  household . member . category(tree)          |
                 |  vendor . document . transaction . line_item  |
                 +-----------------------------------------------+
                    ^              ^              ^          ^
               +----+----+   +-----+-----+  +-----+----+  +--+----+
               | SPESA   |   | UTENZE    |  | ABBONAM. |  | ...   |
               | product |   | contract  |  | subscr.  |  |       |
               | alias   |   | bill+kWh  |  |          |  |       |
               | prezzi  |   | letture   |  |          |  |       |
               +---------+   +-----------+  +----------+  +-------+
```

Ogni modulo ha tabelle proprie per i dati che solo lui capisce (righe prodotto,
letture contatore, GB consumati) **ma scrive sempre una `transaction` nel ledger
comune**.

Conseguenza pratica: la dashboard "quanto e' uscito questo mese" funziona su spesa
+ luce + telefono senza toccare una riga di codice quando aggiungiamo un modulo.
Un modulo nuovo costa: N tabelle sue + un adapter che produce transazioni.

## Le tre regole che tengono in piedi l'estendibilita'

1. **Il ledger e' l'unico punto di verita' per il denaro.** Nessun modulo calcola
   totali per conto suo. Se una spesa esiste, esiste come `transaction`.
2. **Ogni ingestion passa da un contratto canonico.** Foto, JSON esterno, PDF di
   bolletta, inserimento manuale: tutti producono un *draft* tipizzato che viene
   validato prima di toccare il database. Vedi doc 03.
3. **La logica di dominio sta in un package framework-agnostico.** Niente regole di
   business dentro i componenti React. E' l'assicurazione se un giorno servisse un
   client nativo vero al posto del wrapper.

## Stack

| Livello | Scelta | Perche' |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | PWA installabile subito, ottima DX |
| Styling | Tailwind + shadcn/ui + design tokens | UI curata senza combattere il framework |
| Stato server | TanStack Query | cache, invalidazione, offline-friendly |
| Grafici | Recharts | copre tutto quello che serve in dashboard |
| Database | Supabase Postgres | relazionale vero: le query analitiche sono il cuore dell'app |
| Auth | Supabase Auth | login famiglia gratis |
| Storage foto | Supabase Storage (bucket privato) | signed URL, mai file pubblici |
| Isolamento dati | Row Level Security su `household_id` | multi-famiglia sicuro by design |
| Mobile (M5) | Capacitor | stessa codebase, camera nativa, store iOS/Android |

## Struttura del monorepo

```
apps/
  web/                 Next.js: pagine, componenti, route handler
packages/
  core/                dominio puro: tipi, validazione, calcoli, normalizzazione
                       unita', matching prodotti, regole di categorizzazione.
                       Zero dipendenze da React o da Supabase.
  db/                  schema, migration, tipi generati, query analitiche
  ui/                  design system: tokens + componenti condivisi
docs/                  questa documentazione
```

Il confine importante e' `packages/core`: e' testabile senza browser e senza
database, ed e' cio' che sopravvive a un eventuale cambio di frontend o di backend.

## Perche' Capacitor e non React Native

L'obiettivo dichiarato e' arrivare su iOS e Android, ma partendo dal web. Le due
strade sono:

- **Capacitor**: una sola codebase web, wrappata in un contenitore nativo. La
  camera, il filesystem e le notifiche push si usano tramite plugin. Costo di
  ingresso quasi nullo, la UI resta quella curata del web.
- **React Native / Expo**: nativo vero, ma il web diventa un cittadino di seconda
  classe e la UI va ripensata.

Per un'app che e' essenzialmente form + liste + grafici + fotocamera, Capacitor
copre tutto. Se un giorno servisse davvero il nativo, `packages/core` e
`packages/db` si riusano interi e si riscrive solo la UI.
