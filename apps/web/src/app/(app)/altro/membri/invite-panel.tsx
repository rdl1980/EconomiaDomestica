'use client';

import { useState, useTransition } from 'react';
import { Copy, Loader2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/primitives';
import { fullDate } from '@/lib/format';
import { createInvite, revokeInvite } from './actions';

interface Invite {
  id: string;
  code: string;
  role: string;
  expiresAt: string;
}

export function InvitePanel({
  householdId: _householdId,
  invites,
}: {
  householdId: string;
  invites: Invite[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invita qualcuno</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-relaxed text-fg-muted">
          Chi riceve il codice lo inserisce al primo accesso e entra in questa casa. Vede le stesse
          spese e puo' aggiungerne. Il codice scade dopo sette giorni.
        </p>

        {invites.length > 0 ? (
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5"
              >
                <code className="flex-1 font-mono text-base font-semibold tracking-widest text-fg">
                  {invite.code}
                </code>
                <Badge>{invite.role === 'viewer' ? 'sola lettura' : 'adulto'}</Badge>
                <button
                  type="button"
                  aria-label="Copia il codice"
                  className="text-fg-subtle hover:text-fg"
                  onClick={async () => {
                    await navigator.clipboard.writeText(invite.code);
                    setCopied(invite.id);
                    setTimeout(() => setCopied(null), 2000);
                  }}
                >
                  <Copy className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Annulla l'invito"
                  className="text-fg-subtle hover:text-negative"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await revokeInvite(invite.id);
                      if (result.error) setError(result.error);
                    })
                  }
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {copied ? <p className="text-xs text-positive">Codice copiato.</p> : null}
        {error ? <p className="text-xs text-negative">{error}</p> : null}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await createInvite('adult');
                if (result.error) setError(result.error);
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Nuovo codice
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await createInvite('viewer');
                if (result.error) setError(result.error);
              })
            }
          >
            Solo lettura
          </Button>
        </div>

        {invites.length > 0 ? (
          <p className="text-xs text-fg-subtle">
            Il piu' recente scade il {fullDate(invites[0]!.expiresAt)}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
