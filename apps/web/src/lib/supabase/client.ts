'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@ed/db';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * Client Supabase per il browser.
 *
 * Usa solo la anon key, che è pubblica per progetto: la sicurezza reale è la
 * Row Level Security lato database, non il fatto che questa chiave sia nascosta.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
