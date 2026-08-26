import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Compone classi Tailwind risolvendo i conflitti (l'ultima vince). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
