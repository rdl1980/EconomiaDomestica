/**
 * Variabili d'ambiente, con un errore leggibile quando mancano.
 *
 * Le `NEXT_PUBLIC_*` vengono sostituite nel bundle **al momento del build**: se
 * su Vercel non sono impostate prima del primo deploy, finiscono nel codice come
 * `undefined` e l'app si rompe a runtime con un messaggio che non nomina la
 * variabile mancante. Con questo controllo il guasto si vede subito e dice cosa
 * fare.
 *
 * I riferimenti sono scritti per esteso e non costruiti dinamicamente
 * (`process.env[nome]` non funzionerebbe: la sostituzione avviene sul testo).
 */

function required(value: string | undefined, name: string): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Variabile d'ambiente mancante: ${name}.\n` +
        'In locale va in .env.local; su Vercel in Settings → Environment Variables, ' +
        'e poi serve un nuovo deploy perché le NEXT_PUBLIC_* vengono incorporate nel build.',
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  'NEXT_PUBLIC_SUPABASE_URL',
);

export const SUPABASE_ANON_KEY = required(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
);
