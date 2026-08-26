import type { Metadata } from 'next';
import { LogOut, PlugZap, Tags, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/primitives';
import { Card } from '@/components/ui/card';
import { requireSession } from '@/lib/session';
import { SignOutButton } from './sign-out-button';

export const metadata: Metadata = { title: 'Altro' };

const SECTIONS = [
  {
    icon: Users,
    title: 'Membri della casa',
    description: 'Invita chi fa la spesa con te.',
    status: 'in arrivo',
  },
  {
    icon: Tags,
    title: 'Categorie e prodotti',
    description: 'Il catalogo che l’app impara dai tuoi scontrini.',
    status: 'in arrivo',
  },
  {
    icon: PlugZap,
    title: 'Utenze e contratti',
    description: 'Luce, gas, telefono: la spesa di casa oltre la spesa.',
    status: 'in arrivo',
  },
];

export default async function AltroPage() {
  const session = await requireSession();

  return (
    <>
      <PageHeader title="Altro" subtitle={session.email ?? undefined} />

      <div className="space-y-3">
        {SECTIONS.map(({ icon: Icon, title, description, status }) => (
          <Card key={title} className="flex items-center gap-4 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg-muted">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{title}</p>
              <p className="truncate text-xs text-fg-muted">{description}</p>
            </div>
            <Badge>{status}</Badge>
          </Card>
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
