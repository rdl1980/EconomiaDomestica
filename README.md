# Economia Domestica

App per la gestione dell'economia domestica: si parte dagli scontrini della spesa
(foto -> dati strutturati -> dashboard) con un'architettura pensata fin dall'inizio
per estendersi a utenze energetiche, telefonia, abbonamenti e qualunque altra voce
di spesa familiare.

**Stato: pianificazione.** Nessun codice applicativo ancora, solo design.

## Documentazione

| Doc | Contenuto |
|---|---|
| [01 - Architettura](docs/01-architettura.md) | principio portante, stack, struttura del monorepo |
| [02 - Modello dati](docs/02-modello-dati.md) | entita' core, moduli, scelte non ovvie |
| [03 - Pipeline scontrini](docs/03-pipeline-scontrini.md) | dalla foto al ledger, le tre sorgenti di ingestion |
| [04 - Analytics](docs/04-analytics.md) | metriche, viste, cosa vogliamo poter chiedere ai dati |
| [05 - UI/UX](docs/05-ui-ux.md) | direzione visiva e struttura di navigazione |
| [06 - Roadmap](docs/06-roadmap.md) | milestone da M0 a M6 |

## Contratti

- [`docs/schema/receipt-draft.schema.json`](docs/schema/receipt-draft.schema.json) - contratto JSON canonico di uno scontrino
- [`docs/schema/prompt-estrazione.md`](docs/schema/prompt-estrazione.md) - prompt per generare quel JSON esternamente
- [`docs/schema/000-core.sql`](docs/schema/000-core.sql) - schema Postgres di riferimento (design, non ancora migration applicata)

## Decisioni prese

| Ambito | Scelta |
|---|---|
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| Frontend | Next.js + TypeScript + Tailwind + shadcn/ui |
| Mobile | web/PWA prima, wrapping Capacitor per iOS/Android da M5 |
| Ingestion scontrini | vision LLM **e** import JSON esterno, dietro lo stesso contratto |
| Utenti | famiglia condivisa (household multi-membro) |

## Privacy

Il repository e' **pubblico**. Non devono mai finire nel repo: foto di scontrini,
dump o export del database, chiavi API, file `.env`. Vedi `.gitignore`.
