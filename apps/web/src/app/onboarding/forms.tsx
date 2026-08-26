'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { createHousehold, joinHousehold, type ActionState } from './actions';

const INITIAL: ActionState = {};

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" full disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

export function OnboardingForms() {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [createState, createAction] = useActionState(createHousehold, INITIAL);
  const [joinState, joinAction] = useActionState(joinHousehold, INITIAL);

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Modalità di ingresso"
        className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] bg-surface-2 p-1"
      >
        {(
          [
            ['create', 'Crea una casa'],
            ['join', 'Ho un invito'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'h-9 rounded-[calc(var(--radius-control)-2px)] text-sm font-medium transition-colors',
              tab === value ? 'bg-surface text-fg shadow-soft' : 'text-fg-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'create' ? (
        <form action={createAction} className="space-y-4">
          <Field label="Nome della casa" hint="Come vuoi chiamarla: “Casa Rossi”, “Via Verdi”…">
            <Input name="name" required placeholder="Casa" autoComplete="off" />
          </Field>
          <Field label="Il tuo nome" error={createState.error}>
            <Input name="display_name" required placeholder="Riccardo" autoComplete="given-name" />
          </Field>
          <SubmitButton>Crea la casa</SubmitButton>
        </form>
      ) : (
        <form action={joinAction} className="space-y-4">
          <Field
            label="Codice invito"
            hint="Te lo trova chi ha già la casa, in Altro → Membri."
            error={joinState.error}
          >
            <Input
              name="code"
              required
              placeholder="ABCD-1234"
              autoComplete="off"
              className="uppercase tracking-widest"
            />
          </Field>
          <SubmitButton>Entra nella casa</SubmitButton>
        </form>
      )}
    </div>
  );
}
