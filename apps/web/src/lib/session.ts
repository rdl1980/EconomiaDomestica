import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { HouseholdRow, MemberRow } from '@ed/db';

/**
 * Contesto della richiesta: chi è l'utente e in quale household sta lavorando.
 *
 * Avvolto in `cache()` di React: dentro una stessa richiesta più componenti
 * chiamano `requireSession()` e la query parte una volta sola.
 */

export interface SessionContext {
  userId: string;
  email: string | null;
  member: MemberRow;
  household: HouseholdRow;
}

export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Per ora un utente appartiene a un household solo. Lo schema ne regge più
  // di uno: quando servirà, qui si leggerà l'household attivo da un cookie.
  const { data, error } = await supabase
    .from('member')
    .select('*, household:household_id(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const { household, ...member } = data as MemberRow & { household: HouseholdRow | null };
  if (!household) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    member: member as MemberRow,
    household,
  };
});

/** Sessione obbligatoria: senza household si passa dall'onboarding. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect('/onboarding');
  return session;
}

/** true se il membro può modificare i dati (i viewer guardano e basta). */
export function canEdit(session: SessionContext): boolean {
  return session.member.role !== 'viewer';
}
