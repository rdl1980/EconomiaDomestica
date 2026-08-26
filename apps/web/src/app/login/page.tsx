import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/primitives';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Accedi' };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col justify-center bg-bg px-6 py-12">
      <div className="mx-auto w-full max-w-sm space-y-8 animate-fade-up">
        <header className="space-y-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl text-primary-fg shadow-lift">
            €
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Economia Domestica</h1>
            <p className="text-sm text-fg-muted">
              Scontrini, spesa e utenze di casa, in un posto solo.
            </p>
          </div>
        </header>

        {/* useSearchParams richiede un confine di Suspense: senza, la pagina non
            può essere prerenderizzata. */}
        <Suspense fallback={<Skeleton className="h-[9.5rem] w-full" />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-fg-subtle">
          Ti mandiamo un link via email: niente password da ricordare.
        </p>
      </div>
    </div>
  );
}
