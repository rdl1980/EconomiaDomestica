import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { OnboardingForms } from './forms';

export const metadata: Metadata = { title: 'Benvenuto' };

export default async function OnboardingPage() {
  // Chi ha già una casa non ha niente da fare qui.
  const session = await getSession();
  if (session) redirect('/dashboard');

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-bg px-6 py-12">
      <div className="mx-auto w-full max-w-sm space-y-8 animate-fade-up">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Iniziamo</h1>
          <p className="text-sm text-fg-muted">
            Crea la tua casa, oppure entra in quella di qualcun altro con un codice invito.
          </p>
        </header>

        <OnboardingForms />
      </div>
    </div>
  );
}
