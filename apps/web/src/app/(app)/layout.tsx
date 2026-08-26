import { BottomNav } from '@/components/layout/bottom-nav';
import { requireSession } from '@/lib/session';

/**
 * Shell delle schermate autenticate.
 *
 * Il middleware ha già garantito che ci sia un utente; qui si garantisce che
 * ci sia anche un household, altrimenti si passa dall'onboarding.
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  await requireSession();

  return (
    <div className="min-h-dvh bg-bg">
      <main className="mx-auto w-full max-w-lg px-4 pt-4 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}
