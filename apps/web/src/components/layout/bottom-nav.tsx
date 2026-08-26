'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, House, LayoutGrid, ReceiptText, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Navigazione principale.
 *
 * Il pulsante di cattura sta al centro ed è visivamente diverso dagli altri:
 * è il gesto per cui l'app esiste, e deve essere raggiungibile col pollice
 * senza guardare.
 */

const ITEMS = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/spese', label: 'Spese', icon: ReceiptText },
  { href: '/cattura', label: 'Aggiungi', icon: Camera, primary: true },
  { href: '/prezzi', label: 'Prezzi', icon: TrendingDown },
  { href: '/altro', label: 'Altro', icon: LayoutGrid },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-xl pb-safe"
    >
      <ul className="mx-auto flex max-w-lg items-end justify-around px-2 pt-1.5 pb-1.5">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          if ('primary' in item && item.primary) {
            return (
              <li key={item.href} className="-mt-6">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex size-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lift transition-transform active:scale-95',
                    active && 'ring-4 ring-[var(--ring)]',
                  )}
                >
                  <Icon className="size-6" strokeWidth={2.2} />
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-fg-subtle hover:text-fg-muted',
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
