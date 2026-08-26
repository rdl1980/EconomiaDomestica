import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Target touch minimo 44px sulle varianti principali: l'app si usa con il
 * pollice, in piedi, spesso con una mano sola.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-fg shadow-soft hover:bg-primary-hover',
        secondary:
          'bg-surface-2 text-fg border border-border hover:border-border-strong',
        ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        outline: 'border border-border-strong text-fg hover:bg-surface-2',
        danger: 'bg-negative text-white hover:opacity-90',
        soft: 'bg-primary-soft text-primary hover:brightness-95',
      },
      size: {
        sm: 'h-9 px-3',
        md: 'h-11 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'size-11',
        'icon-sm': 'size-9',
      },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', full: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  full,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp className={cn(buttonVariants({ variant, size, full }), className)} {...props} />
  );
}

export { buttonVariants };
