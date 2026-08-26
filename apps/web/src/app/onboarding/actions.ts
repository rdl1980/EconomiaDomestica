'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface ActionState {
  error?: string;
}

/**
 * Creazione dell'household.
 *
 * Passa dalla funzione SQL `create_household` e non da due insert separate:
 * household e membro devono nascere insieme, altrimenti la RLS taglierebbe
 * fuori chi ha appena creato la casa dalla casa stessa.
 */
export async function createHousehold(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const displayName = String(formData.get('display_name') ?? '').trim();

  if (name.length < 2) return { error: 'Dai un nome alla casa (almeno 2 caratteri).' };
  if (displayName.length < 2) return { error: 'Come ti chiami?' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_household', {
    p_name: name,
    p_display_name: displayName,
  });

  if (error) return { error: error.message };
  redirect('/dashboard');
}

export async function joinHousehold(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  if (code.length < 4) return { error: 'Inserisci il codice che ti hanno mandato.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_household_invite', { p_code: code });

  if (error) return { error: error.message };
  redirect('/dashboard');
}
