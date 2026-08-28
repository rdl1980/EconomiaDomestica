import { redirect } from 'next/navigation';

/**
 * Ingresso dell'app.
 *
 * Oltre al normale rimando alla dashboard, fa da rete di sicurezza per il link
 * di accesso: se in Supabase l'URL `/auth/callback` non è fra le redirect
 * consentite, GoTrue rimanda alla Site URL — cioè qui — portandosi dietro il
 * `code`. Senza questo inoltro il codice andrebbe perso e il login fallirebbe
 * in silenzio, con l'utente rispedito alla schermata di accesso senza spiegazioni.
 */
export default async function RootPage({ searchParams }: PageProps<'/'>) {
  const params = await searchParams;
  const raw = params.code;
  const code = Array.isArray(raw) ? raw[0] : raw;

  if (code) {
    const next = Array.isArray(params.next) ? params.next[0] : params.next;
    const target = new URLSearchParams({ code });
    if (next && next.startsWith('/') && !next.startsWith('//')) target.set('next', next);
    redirect(`/auth/callback?${target.toString()}`);
  }

  redirect('/dashboard');
}
