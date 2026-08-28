# 07 - Deploy

## Impostazioni del progetto Vercel

Il repository è un monorepo npm, quindi una sola impostazione conta più di tutte
le altre:

| Impostazione | Valore |
|---|---|
| **Root Directory** | `apps/web` |
| Framework | Next.js (rilevato) |
| Install / Build / Output | lasciare i default |
| Node.js | 22.x |

Vercel riconosce i workspace npm e installa dalla radice del repository, quindi
`@ed/core` e `@ed/db` vengono risolti anche se stanno fuori da `apps/web`.
`next.config.ts` li dichiara in `transpilePackages` perché sono TypeScript non
compilato.

`apps/web/vercel.json` fissa la regione a **`dub1` (Dublino)**: è la stessa in cui
sta il database (AWS eu-west-1). Ogni Server Component fa una o più query a
Supabase, e servirle dall'altra parte dell'Atlantico aggiungerebbe un centinaio di
millisecondi a ciascuna. Se il piano non consente di scegliere la regione, si
toglie la chiave `regions` e il deploy riparte.

## Variabili d'ambiente

Vanno impostate **prima** del primo build: le `NEXT_PUBLIC_*` non vengono lette a
runtime, vengono sostituite nel bundle durante la compilazione. Se mancano, il
build si interrompe dicendo quale manca (`apps/web/src/lib/env.ts`), il che è
molto meglio di un'app che si rompe in produzione senza spiegazioni.

| Variabile | Ambienti | Note |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | tutti | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tutti | pubblica per progetto: la sicurezza è la RLS, non la segretezza di questa chiave |
| `ANTHROPIC_API_KEY` | production | opzionale, accende la lettura automatica delle foto |
| `RECEIPT_VISION_MODEL` | production | opzionale, default `claude-opus-5` |

`DATABASE_URL` **non** va su Vercel: serve solo alle migration, che si lanciano
da locale. L'app in esecuzione parla con Supabase via PostgREST, mai in SQL
diretto.

## Supabase: URL di autenticazione

Il passaggio che si dimentica sempre, e che rompe il login in produzione senza
messaggi d'errore. In *Authentication → URL Configuration*:

- **Site URL**: l'indirizzo di produzione (es. `https://economia-domestica.vercel.app`)
- **Redirect URLs**: aggiungere sia la produzione sia lo sviluppo, e anche le
  anteprime se si vuole poterle usare:

  ```
  https://<dominio-di-produzione>/**
  http://localhost:3000/**
  https://*-<scope>.vercel.app/**
  ```

Se `/auth/callback` non è fra gli indirizzi consentiti, GoTrue rimanda alla Site
URL portandosi dietro il codice. L'app se ne difende — la pagina radice inoltra
il codice al callback — ma è una rete di sicurezza, non un sostituto della
configurazione: con la Site URL ancora su `localhost`, un link aperto dal
telefono porterebbe comunque a un indirizzo irraggiungibile.

## Deploy dalla riga di comando

Con un token da [vercel.com/account/tokens](https://vercel.com/account/tokens):

```bash
npx vercel link --yes --project economia-domestica --cwd apps/web --token "$VERCEL_TOKEN"
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production --cwd apps/web --token "$VERCEL_TOKEN"
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --cwd apps/web --token "$VERCEL_TOKEN"
npx vercel deploy --prod --cwd apps/web --token "$VERCEL_TOKEN"
```

Collegando poi il repository GitHub dalla dashboard, ogni push su `main` fa un
deploy di produzione e ogni pull request una preview.

## Dopo il primo deploy

1. Aggiornare Site URL e Redirect URLs in Supabase (sopra).
2. Provare il login dal telefono: è lì che l'app deve funzionare davvero.
3. Controllare che la fotocamera si apra da `/cattura/foto` — richiede HTTPS,
   quindi in locale funziona solo su `localhost` e in produzione solo sul dominio
   con certificato.
