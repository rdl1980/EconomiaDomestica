import type * as React from 'react';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

type BadgeTone = 'neutral' | 'primary' | 'positive' | 'negative' | 'warning';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-fg-muted border-border',
  primary: 'bg-primary-soft text-primary border-transparent',
  positive: 'bg-positive-soft text-positive border-transparent',
  negative: 'bg-negative-soft text-negative border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.ComponentProps<'span'> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                    */
/* -------------------------------------------------------------------------- */

/** Skeleton e non spinner: l'attesa deve avere la forma del contenuto che arriva. */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('skeleton rounded-lg', className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Input                                                                       */
/* -------------------------------------------------------------------------- */

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm text-fg',
        'placeholder:text-fg-subtle',
        'focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--ring)]',
        'disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-[var(--radius-control)] border border-border bg-surface p-3 text-sm text-fg',
        'placeholder:text-fg-subtle',
        'focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--ring)]',
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs text-negative">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-fg-subtle">{hint}</span>
      ) : null}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Stato vuoto                                                                 */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="text-fg-subtle [&_svg]:size-8">{icon}</div> : null}
      <div className="space-y-1">
        <p className="font-medium text-fg">{title}</p>
        {description ? (
          <p className="mx-auto max-w-xs text-sm text-fg-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Delta                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Variazione rispetto a un periodo di confronto.
 *
 * `invert` esiste perché nel dominio della spesa **spendere di più è peggio**:
 * il verde va al segno negativo. Farlo esplicito evita di trovarsi con grafici
 * che dicono il contrario di quello che sembrano.
 */
export function Delta({
  value,
  invert = true,
  className,
}: {
  value: number | null;
  invert?: boolean;
  className?: string;
}) {
  if (value === null) {
    return <span className={cn('text-xs text-fg-subtle', className)}>—</span>;
  }

  const isUp = value > 0;
  const isGood = invert ? !isUp : isUp;
  const tone =
    Math.abs(value) < 0.5 ? 'text-fg-muted' : isGood ? 'text-positive' : 'text-negative';

  return (
    <span className={cn('tabular text-xs font-medium', tone, className)}>
      {isUp ? '▲' : value < 0 ? '▼' : '•'}{' '}
      {new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(Math.abs(value))}%
    </span>
  );
}
