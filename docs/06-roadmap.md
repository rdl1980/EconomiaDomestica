# 06 - Roadmap

> **Stato al 26 agosto 2026** — M0, M1, M2, M3 e M4 sono implementate e
> compilano; le migration sono verificate su un Postgres reale (in WASM) dalla
> CI. Manca **l'applicazione delle migration sul progetto Supabase**: finché non
> viene fatta, l'app non ha un database dietro. Vedi il fondo pagina.

Ogni milestone e' pensata per chiudersi con qualcosa di **usabile davvero**, non con
un pezzo di infrastruttura. Il criterio e' sempre lo stesso: alla fine della
milestone, l'app fa qualcosa in piu' che prima non poteva fare.

## M0 - Fondamenta

- monorepo pnpm, TypeScript, lint/format, CI su GitHub Actions
- progetto Supabase, migration dello schema core, RLS attiva
- Next.js deployato, login funzionante, creazione household
- design tokens e shell dell'app (bottom nav, tema chiaro/scuro)

*Fatto quando*: entri, fai login, vedi un'app vuota ma tua.

## M1 - Ingestion scontrini

- upload foto su storage privato, entita' `document`, stati della pipeline
- contratto `ReceiptDraft` implementato e validato
- sorgente [B] import JSON + sorgente [C] inserimento manuale
- sorgente [A] vision LLM
- schermata di revisione con validazione contabile
- conferma -> scrittura di `transaction` + `line_item`

*Fatto quando*: fotografi uno scontrino e i dati finiscono nel database corretti.

## M2 - Dashboard v1

- KPI del mese, confronto con periodo precedente
- ripartizione per negozio e per categoria
- elenco spese con ricerca e filtri persistiti nell'URL
- dettaglio di una spesa con la foto originale affiancata

*Fatto quando*: sai dove sono finiti i soldi senza aprire un foglio di calcolo.

## M3 - Prodotti e prezzi

- catalogo prodotti + gestione alias + apprendimento dalle correzioni
- `price_observation` popolata, prezzo normalizzato per unita'
- schermata confronto prezzi per prodotto e per negozio
- inflazione personale, indicatore di offerta reale

*Fatto quando*: l'app ti dice dove conviene comprare cosa. Qui l'app inizia a
valere piu' di un foglio Excel.

## M4 - Utenze

- contratti (luce, gas, telefonia, internet) e fornitori
- bollette con importo **e consumo** (kWh, smc, GB), letture contatore
- import bollette PDF con lo stesso contratto di ingestion
- statistiche consumo vs costo: separare effetto quantita' ed effetto prezzo

*Fatto quando*: la dashboard mostra la spesa domestica completa, non solo la spesa.

## M5 - Mobile

- rifinitura PWA (installabile, offline sulle viste gia' caricate)
- integrazione Capacitor, camera nativa, build iOS e Android
- pubblicazione su TestFlight e Play Console (canale interno)

*Fatto quando*: l'app e' sul telefono e la fotocamera parte in mezzo secondo.

## M6 - Intelligenza

- budget per categoria con alert
- proiezione di fine mese, rilevamento anomalie
- lista della spesa suggerita con stima di costo per negozio
- report mensile automatico

## Cosa resta deliberatamente fuori per ora

Da riconsiderare piu' avanti, non da dimenticare: import da conto corrente
(PSD2/open banking), gestione cespiti e manutenzioni casa, scadenzario documenti,
divisione spese fra coinquilini, export fiscale.

---

## Stato attuale

| M | Stato | Note |
|---|---|---|
| M0 | fatto | monorepo, dominio, schema, auth, shell |
| M1 | fatto | tre sorgenti di ingestion, revisione, conferma nel ledger |
| M2 | fatto | dashboard, aggregazioni SQL, filtri nell'URL |
| M3 | fatto | catalogo, alias, confronto prezzi, inflazione personale, offerte vere |
| M4 | fatto | contratti, bollette con consumo, scomposizione prezzo/consumo |
| M5 | da fare | PWA e Capacitor |
| M6 | da fare | budget, previsioni, avvisi |

### Cosa manca per usarla davvero

1. **Applicare le migration** al progetto Supabase (`npm run db:migrate` con
   `DATABASE_URL` valorizzata, oppure incollando i file di
   `packages/db/migrations` nel SQL Editor **in ordine**).
2. **Deploy su Vercel**, collegando il repository e impostando
   `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. **Opzionale**: `ANTHROPIC_API_KEY` per la lettura automatica delle foto.
   Senza, restano l'import JSON e l'inserimento manuale.
