'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCategoryMap } from '@/lib/data/catalog';
import { canEdit, requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { UTILITY_TYPES, utilityConfig } from './config';

export interface UtilityActionResult {
  error?: string;
  id?: string;
}

const UTILITY_VALUES = UTILITY_TYPES.map((t) => t.value) as [
  (typeof UTILITY_TYPES)[number]['value'],
  ...(typeof UTILITY_TYPES)[number]['value'][],
];

const contractSchema = z.object({
  type: z.enum(UTILITY_VALUES),
  name: z.string().trim().min(1).max(120),
  vendorName: z.string().trim().max(120).nullable(),
  code: z.string().trim().max(60).nullable(),
  startedOn: z.string().nullable(),
  notes: z.string().trim().max(500).nullable(),
});

export async function createContract(input: unknown): Promise<UtilityActionResult> {
  const session = await requireSession();
  if (!canEdit(session)) return { error: 'Non hai i permessi per gestire le utenze.' };

  const parsed = contractSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' };
  const c = parsed.data;

  const householdId = session.household.id;
  const supabase = await createClient();
  const config = utilityConfig(c.type);
  const categoryMap = await getCategoryMap(householdId);

  /**
   * Il fornitore è un `vendor` come il supermercato: stessa entità, `type`
   * diverso. È ciò che permette al ledger di restare uno solo.
   */
  let vendorId: string | null = null;
  if (c.vendorName) {
    const { data: existing } = await supabase
      .from('vendor')
      .select('id')
      .eq('household_id', householdId)
      .ilike('name', c.vendorName)
      .maybeSingle();

    if (existing) {
      vendorId = existing.id;
    } else {
      const vendorType =
        c.type === 'energia_elettrica'
          ? 'energia'
          : c.type === 'gas'
            ? 'gas'
            : c.type === 'acqua'
              ? 'acqua'
              : c.type === 'telefonia'
                ? 'telefonia'
                : c.type === 'internet'
                  ? 'internet'
                  : 'servizi';

      const { data: created, error } = await supabase
        .from('vendor')
        .insert({ household_id: householdId, name: c.vendorName, type: vendorType })
        .select('id')
        .single();
      if (error) return { error: `Fornitore: ${error.message}` };
      vendorId = created.id;
    }
  }

  const { data, error } = await supabase
    .from('utility_contract')
    .insert({
      household_id: householdId,
      vendor_id: vendorId,
      type: c.type,
      name: c.name,
      code: c.code,
      consumption_unit: config.unit,
      category_id: categoryMap.get(config.categorySlug) ?? null,
      started_on: c.startedOn,
      notes: c.notes,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  revalidatePath('/altro/utenze');
  return { id: data.id };
}

const billSchema = z.object({
  contractId: z.uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  amount: z.number().positive('L’importo deve essere maggiore di zero'),
  consumption: z.number().min(0).nullable(),
  issuedOn: z.string().nullable(),
  dueOn: z.string().nullable(),
  meterStart: z.number().min(0).nullable(),
  meterEnd: z.number().min(0).nullable(),
  isEstimated: z.boolean(),
  notes: z.string().trim().max(500).nullable(),
});

/**
 * Registra una bolletta.
 *
 * Passa dalla funzione SQL perché bolletta, movimento e riga devono nascere
 * insieme: una bolletta senza movimento sparirebbe dai totali di casa, un
 * movimento senza bolletta sarebbe una spesa senza spiegazione.
 */
export async function recordBill(input: unknown): Promise<UtilityActionResult> {
  const session = await requireSession();
  if (!canEdit(session)) return { error: 'Non hai i permessi per gestire le utenze.' };

  const parsed = billSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' };
  const b = parsed.data;

  if (new Date(b.periodEnd) < new Date(b.periodStart)) {
    return { error: 'Il periodo finisce prima di iniziare.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_utility_bill', {
    p_contract: b.contractId,
    p_period_start: b.periodStart,
    p_period_end: b.periodEnd,
    p_amount: b.amount,
    p_consumption: b.consumption,
    p_issued_on: b.issuedOn,
    p_due_on: b.dueOn,
    p_meter_start: b.meterStart,
    p_meter_end: b.meterEnd,
    p_is_estimated: b.isEstimated,
    p_notes: b.notes,
  });

  if (error) {
    if (error.message.includes('utility_bill_period_uidx')) {
      return { error: 'Per questo periodo c’è già una bolletta registrata.' };
    }
    return { error: error.message };
  }

  revalidatePath('/altro/utenze');
  revalidatePath(`/altro/utenze/${b.contractId}`);
  revalidatePath('/dashboard');
  revalidatePath('/spese');
  return { id: data };
}
