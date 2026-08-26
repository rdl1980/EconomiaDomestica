import type * as React from 'react';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle ? <p className="text-sm text-fg-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
