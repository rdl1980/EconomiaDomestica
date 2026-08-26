'use server';

import { revalidatePath } from 'next/cache';
import { canEdit, requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export interface InviteResult {
  code?: string;
  error?: string;
}

/**
 * Genera un codice invito.
 *
 * Il codice lo produce il database, non il client: cosi' il formato e' sempre
 * lo stesso e l'unicita' e' garantita da un controllo dentro la stessa
 * transazione che lo inserisce.
 */
export async function createInvite(role: 'adult' | 'viewer'): Promise<InviteResult> {
  const session = await requireSession();
  if (!canEdit(session)) return { error: 'Non hai i permessi per invitare qualcuno.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_household_invite', {
    p_household: session.household.id,
    p_role: role,
  });

  if (error) return { error: error.message };
  revalidatePath('/altro/membri');
  return { code: data };
}

export async function revokeInvite(inviteId: string): Promise<InviteResult> {
  const session = await requireSession();
  if (!canEdit(session)) return { error: 'Non hai i permessi.' };

  const supabase = await createClient();
  const { error } = await supabase.from('household_invite').delete().eq('id', inviteId);
  if (error) return { error: error.message };

  revalidatePath('/altro/membri');
  return {};
}
