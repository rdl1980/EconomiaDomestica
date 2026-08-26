'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { UtilityType } from '@ed/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/primitives';
import { UTILITY_TYPES, utilityConfig } from '@/lib/utilities/config';
import { createContract } from '@/lib/utilities/actions';

export function NewContractForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<UtilityType>('energia_elettrica');
  const [name, setName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [code, setCode] = useState('');
  const [startedOn, setStartedOn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const config = utilityConfig(type);

  if (!open) {
    return (
      <Button variant="secondary" size="lg" full onClick={() => setOpen(true)}>
        <Plus /> Aggiungi un contratto
      </Button>
    );
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createContract({
        type,
        name: name.trim() || config.label,
        vendorName: vendorName.trim() || null,
        code: code.trim() || null,
        startedOn: startedOn || null,
        notes: null,
      });
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        setName('');
        setVendorName('');
        setCode('');
        router.refresh();
        if (result.id) router.push(`/altro/utenze/${result.id}`);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuovo contratto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Tipo">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as UtilityType)}
            className="h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-2 text-sm text-fg"
          >
            {UTILITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Nome"
          hint={`Come lo chiami tu, es. "${config.label} casa".`}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={config.label} />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Fornitore">
            <Input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Enel, Eni, Iliad…"
            />
          </Field>
          <Field label="Codice" hint="POD, PDR o numero di linea.">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="—" />
          </Field>
        </div>

        <Field label="Attivo da">
          <Input type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />
        </Field>

        <p className="text-xs leading-relaxed text-fg-subtle">
          {config.unit
            ? `Le bollette di questo tipo registrano anche il consumo in ${config.unit} (${config.unitLabel}).`
            : 'Questo tipo di contratto non ha un consumo misurato: verrà chiesto solo l’importo.'}
        </p>

        {error ? <p className="text-xs text-negative">{error}</p> : null}

        <div className="flex gap-2">
          <Button size="lg" full onClick={handleSubmit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null} Crea contratto
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setOpen(false)} disabled={pending}>
            Annulla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
