'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@ed/db';

/**
 * Client Supabase per il browser.
 *
 * Usa solo la anon key, che è pubblica per progetto: la sicurezza reale è la
 * Row Level Security lato database, non il fatto che questa chiave sia nascosta.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
