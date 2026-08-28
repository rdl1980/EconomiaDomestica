import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@ed/db';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * Client Supabase lato server (Server Component, Server Action, Route Handler).
 *
 * Va creato a ogni richiesta: tiene i cookie di sessione di quella richiesta e
 * non è riutilizzabile fra utenti diversi.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Nei Server Component i cookie sono in sola lettura: il refresh del
          // token lo fa il proxy, quindi qui si può ignorare senza danno.
        }
      },
    },
  });
}
