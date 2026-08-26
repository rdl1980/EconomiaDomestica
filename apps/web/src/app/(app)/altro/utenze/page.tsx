import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, PlugZap } from 'lucide-react';
import { numericToCents } from '@ed/db';
import { Card } from '@/components/ui/card';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { euro, fullDate } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { utilityConfig } from '@/lib/utilities/config';
import { NewContractForm } from './new-contract-form';

export const metadata: Metadata = { title: 'Utenze e contratti' };

export default async function UtenzePage() {
  const session = await requireSession();
  const householdId = session.household.id;
  const supabase = await createClient();

  const { data: contracts } = await supabase
    .from('utility_contract')
    .select('id, type, name, code, consumption_unit, started_on, vendor:vendor_id(name)')
    .eq('household_id', householdId)
    .is('ended_on', null)
    .order('type');

  // Ultima bolletta per contratto: è l'informazione che serve nell'elenco.
  const { data: bills } = await supabase
    .from('utility_bill')
    .select('contract_id, period_end, amount, consumption, is_estimated')
    .eq('household_id', householdId)
    .order('period_end', { ascending: false });

  const lastBill = new Map<string, (typeof bills extends (infer T)[] | null ? T : never)>();
  for (const bill of bills ?? []) {
    if (!lastBill.has(bill.contract_id)) lastBill.set(bill.contract_id, bill);
  }

  return (
    <>
      <Link
        href="/altro"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Altro
      </Link>

      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Utenze e contratti</h1>
        <p className="text-sm text-fg-muted">
          Luce, gas, telefono. Le bollette entrano negli stessi totali della spesa, ma qui si
          registra anche il <span className="text-fg">consumo</span>: è l&apos;unico modo per
          distinguere un aumento dei prezzi da un aumento dei consumi.
        </p>
      </header>

      {contracts && contracts.length > 0 ? (
        <ul className="mb-6 space-y-2">
          {contracts.map((contract) => {
            const config = utilityConfig(contract.type);
            const vendor = Array.isArray(contract.vendor) ? contract.vendor[0] : contract.vendor;
            const last = lastBill.get(contract.id);

            return (
              <li key={contract.id}>
                <Link href={`/altro/utenze/${contract.id}`} className="block">
                  <Card className="flex items-center gap-3 p-4 transition-all active:scale-[0.99]">
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
                      style={{ background: `${config.color}22`, color: config.color }}
                    >
                      {config.label.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{contract.name}</p>
                      <p className="truncate text-xs text-fg-muted">
                        {config.label}
                        {vendor ? ` · ${vendor.name}` : ''}
                        {last ? ` · ultima ${fullDate(last.period_end)}` : ' · nessuna bolletta'}
                      </p>
                    </div>
                    {last ? (
                      <div className="shrink-0 text-right">
                        <p className="tabular text-sm font-semibold text-fg">
                          {euro(numericToCents(last.amount))}
                        </p>
                        {last.is_estimated ? <Badge tone="warning">stimata</Badge> : null}
                      </div>
                    ) : null}
                    <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          className="mb-6"
          icon={<PlugZap />}
          title="Nessun contratto"
          description="Aggiungi la prima utenza: da lì in poi ogni bolletta finisce sia nello storico dei consumi sia nei totali di casa."
        />
      )}

      <NewContractForm />
    </>
  );
}
