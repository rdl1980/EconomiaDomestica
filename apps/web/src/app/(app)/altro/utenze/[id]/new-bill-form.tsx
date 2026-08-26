'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/primitives';
import { recordBill } from '@/lib/utilities/actions';

/** Giorno successivo a una data ISO: il periodo nuovo parte dove finisce il precedente. */
function nextDay(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function NewBillForm({
  contractId,
  consumptionUnit,
  lastPeriodEnd,
}: {
  contractId: string;
  consumptionUnit: string | null;
  lastPeriodEnd: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState(lastPeriodEnd ? nextDay(lastPeriodEnd) : '');
  const [periodEnd, setPeriodEnd] = useState('');
  const [amount, setAmount] = useState('');
  const [consumption, setConsumption] = useState('');
  const [meterStart, setMeterStart] = useState('');
  const [meterEnd, setMeterEnd] = useState('');
  const [isEstimated, setIsEstimated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="secondary" size="lg" full onClick={() => setOpen(true)}>
        <Plus /> Registra una bolletta
      </Button>
    );
  }

  // Se ci sono entrambe le letture, il consumo si ricava da solo: chiederlo di
  // nuovo sarebbe un'occasione in più di sbagliarlo.
  const derivedConsumption =
    meterStart !== '' && meterEnd !== '' && Number(meterEnd) >= Number(meterStart)
      ? Number(meterEnd) - Number(meterStart)
      : null;

  const effectiveConsumption =
    consumption !== '' ? Number(consumption) : derivedConsumption;

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await recordBill({
        contractId,
        periodStart,
        periodEnd,
        amount: Number(amount),
        consumption: effectiveConsumption,
        issuedOn: null,
        dueOn: null,
        meterStart: meterStart === '' ? null : Number(meterStart),
        meterEnd: meterEnd === '' ? null : Number(meterEnd),
        isEstimated,
        notes: null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setAmount('');
      setConsumption('');
      setMeterStart('');
      setMeterEnd('');
      router.refresh();
    });
  }

  const ready = periodStart !== '' && periodEnd !== '' && Number(amount) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuova bolletta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dal">
            <Input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </Field>
          <Field label="Al">
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </Field>
        </div>

        <Field label="Importo totale">
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="tabular"
          />
        </Field>

        {consumptionUnit ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Lettura iniziale">
                <Input
                  type="number"
                  step="0.001"
                  inputMode="decimal"
                  value={meterStart}
                  onChange={(e) => setMeterStart(e.target.value)}
                  placeholder="—"
                  className="tabular"
                />
              </Field>
              <Field label="Lettura finale">
                <Input
                  type="number"
                  step="0.001"
                  inputMode="decimal"
                  value={meterEnd}
                  onChange={(e) => setMeterEnd(e.target.value)}
                  placeholder="—"
                  className="tabular"
                />
              </Field>
            </div>

            <Field
              label={`Consumo (${consumptionUnit})`}
              hint={
                derivedConsumption !== null && consumption === ''
                  ? `Calcolato dalle letture: ${derivedConsumption} ${consumptionUnit}.`
                  : 'Se non hai le letture, scrivilo direttamente.'
              }
            >
              <Input
                type="number"
                step="0.001"
                inputMode="decimal"
                value={consumption}
                onChange={(e) => setConsumption(e.target.value)}
                placeholder={derivedConsumption !== null ? String(derivedConsumption) : '0'}
                className="tabular"
              />
            </Field>
          </>
        ) : null}

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={isEstimated}
            onChange={(e) => setIsEstimated(e.target.checked)}
            className="mt-0.5 size-4 rounded border-border"
          />
          <span className="text-xs leading-relaxed text-fg-muted">
            <span className="font-medium text-fg">Bolletta stimata</span> — segnala i consumi non
            letti dal contatore. Senza questa spunta il conguaglio successivo sembrerà
            un&apos;impennata dei consumi che non è mai avvenuta.
          </span>
        </label>

        {error ? <p className="text-xs text-negative">{error}</p> : null}

        <div className="flex gap-2">
          <Button size="lg" full onClick={handleSubmit} disabled={pending || !ready}>
            {pending ? <Loader2 className="animate-spin" /> : null} Registra
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setOpen(false)} disabled={pending}>
            Annulla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
