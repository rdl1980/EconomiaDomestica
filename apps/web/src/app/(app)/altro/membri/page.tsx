import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/primitives';
import { fullDate } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { InvitePanel } from './invite-panel';

export const metadata: Metadata = { title: 'Membri della casa' };

const ROLE_LABEL: Record<string, string> = {
  owner: 'proprietario',
  adult: 'adulto',
  viewer: 'sola lettura',
};

export default async function MembriPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from('member')
      .select('id, display_name, role, created_at, user_id')
      .eq('household_id', session.household.id)
      .order('created_at'),
    supabase
      .from('household_invite')
      .select('id, code, role, expires_at, accepted_at')
      .eq('household_id', session.household.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ]);

  return (
    <>
      <Link
        href="/altro"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Altro
      </Link>

      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Membri della casa</h1>
        <p className="text-sm text-fg-muted">{session.household.name}</p>
      </header>

      <ul className="mb-6 space-y-2">
        {(members ?? []).map((member) => (
          <li key={member.id}>
            <Card className="flex items-center gap-3 p-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                {member.display_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">
                  {member.display_name}
                  {member.user_id === session.userId ? (
                    <span className="text-fg-subtle"> · tu</span>
                  ) : null}
                </p>
                <p className="text-xs text-fg-muted">dal {fullDate(member.created_at)}</p>
              </div>
              <Badge tone={member.role === 'owner' ? 'primary' : 'neutral'}>
                {ROLE_LABEL[member.role] ?? member.role}
              </Badge>
            </Card>
          </li>
        ))}
      </ul>

      <InvitePanel
        householdId={session.household.id}
        invites={(invites ?? []).map((i) => ({
          id: i.id,
          code: i.code,
          role: i.role,
          expiresAt: i.expires_at,
        }))}
      />
    </>
  );
}
