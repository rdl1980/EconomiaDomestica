import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * Rinnova la sessione Supabase a ogni richiesta e protegge le route private.
 *
 * Il refresh deve stare qui perché i Server Component non possono scrivere
 * cookie: senza questo passaggio la sessione scadrebbe e l'utente verrebbe
 * buttato fuori nel mezzo di una revisione scontrino.
 *
 * In Next 16 la convenzione `middleware.ts` è deprecata a favore di `proxy.ts`.
 */

const PUBLIC_PATHS = ['/login', '/auth', '/invito'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() e non getSession(): valida il token contro il server invece di
  // fidarsi del cookie, che l'utente controlla.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  // Atterraggio del link di accesso: quando `/auth/callback` non e' fra le
  // redirect consentite in Supabase, GoTrue rimanda alla Site URL portandosi
  // dietro il `code`. Se lo bloccassimo qui, il codice andrebbe perso e il login
  // fallirebbe in silenzio. La pagina radice lo inoltra al callback.
  const isAuthLanding = path === '/' && request.nextUrl.searchParams.has('code');

  if (!user && !isPublic && !isAuthLanding) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }

  if (user && path === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Tutto tranne asset statici e immagini.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
