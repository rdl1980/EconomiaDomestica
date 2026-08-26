import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, LogOut, PlugZap, Tags, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/primitives';
import { Card } from '@/components/ui/card';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { SignOutButton } from './sign-out-button';

export const metadata: Metadata = { title: 'Altro' };

export default async function AltroPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [{ count: memberCount }, { count: productCount }, { count: contractCount }] =
    await Promise.all([
      supabase
        .from('member')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', session.household.id),
      supabase
        .from('product')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', session.household.id),
      supabase
        .from('utility_contract')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', session.household.id),
    ]);

  const sections = [
    {
      href: '/altro/membri',
      icon: Users,
      title: 'Membri della casa',
      description: 'Invita chi fa la spesa con te.',
      badge: memberCount ? String(memberCount) : null,
    },
    {
      href: '/altro/prodotti',
      icon: Tags,
      title: 'Catalogo prodotti',
      description: 'Quello che l’app ha imparato dai tuoi scontrini.',
      badge: productCount ? String(productCount) : null,
    },
    {
      href: '/altro/utenze',
      icon: PlugZap,
      title: 'Utenze e contratti',
      description: 'Luce, gas, telefono: la spesa di casa oltre la spesa.',
      badge: contractCount ? String(contractCount) : null,
    },
  ] as const;

  return (
    <>
      <PageHeader title="Altro" subtitle={session.email ?? undefined} />

      <div className="space-y-3">
        {sections.map(({ href, icon: Icon, title, description, badge }) => (
          <Link key={href} href={href} className="block">
            <Card className="flex items-center gap-4 p-4 transition-all active:scale-[0.99] hover:border-border-strong">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg-muted">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{title}</p>
                <p className="truncate text-xs text-fg-muted">{description}</p>
              </div>
              {badge ? <Badge>{badge}</Badge> : null}
              <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
            </Card>
          </Link>
        ))}

        <Card className="flex items-center gap-4 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg-muted">
            <LogOut className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">Esci</p>
            <p className="truncate text-xs text-fg-muted">{session.household.name}</p>
          </div>
          <SignOutButton />
        </Card>
      </div>
    </>
  );
}
