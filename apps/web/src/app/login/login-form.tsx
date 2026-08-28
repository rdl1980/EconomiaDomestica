'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';

type State = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Motivi per cui si puo' atterrare qui da un link di accesso fallito.
 * Senza questa traduzione l'utente tornerebbe al form senza sapere perche',
 * e riproverebbe lo stesso link scaduto all'infinito.
 */
const LANDING_ERRORS: Record<string, string> = {
  'link-scaduto': 'Quel link non è più valido: i link di accesso durano poco. Te ne mandiamo uno nuovo.',
  'link-non-valido': 'Il link di accesso non era completo. Richiedine un altro qui sotto.',
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  const landingError = LANDING_ERRORS[searchParams.get('error') ?? ''] ?? null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState('sending');
    setError(null);

    const redirect = searchParams.get('redirect') ?? '/dashboard';
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
      },
    });

    if (authError) {
      setState('error');
      setError(authError.message);
      return;
    }
    setState('sent');
  }

  if (state === 'sent') {
    return (
      <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-6 text-center shadow-soft">
        <MailCheck className="mx-auto size-8 text-positive" />
        <div className="space-y-1">
          <p className="font-medium text-fg">Controlla la posta</p>
          <p className="text-sm text-fg-muted">
            Abbiamo inviato un link di accesso a <span className="text-fg">{email}</span>.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setState('idle')}>
          Usa un altro indirizzo
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {landingError && !error ? (
        <p className="rounded-[var(--radius-control)] bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-fg-muted">
          {landingError}
        </p>
      ) : null}

      <Field label="Email" error={error ?? undefined}>
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="tu@esempio.it"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={state === 'sending'}
        />
      </Field>

      <Button type="submit" size="lg" full disabled={state === 'sending' || email.length < 5}>
        {state === 'sending' ? (
          <>
            <Loader2 className="animate-spin" /> Invio in corso
          </>
        ) : (
          'Ricevi il link di accesso'
        )}
      </Button>
    </form>
  );
}
