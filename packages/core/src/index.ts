/**
 * @ed/core - dominio di Economia Domestica.
 *
 * Regola del package: nessuna dipendenza da React, Next, Supabase o dal DOM.
 * Tutto qui dentro deve essere eseguibile in un test senza browser e senza
 * database. È la parte che sopravvive a un cambio di frontend o di backend.
 */

export * from './money';
export * from './units';

export * from './receipt/draft';
export * from './receipt/validate';
export * from './receipt/json-schema';
export * from './receipt/prepare';

export * from './matching/normalize';
export * from './matching/similarity';
export * from './matching/resolve';

export * from './taxonomy/categories';
export * from './taxonomy/categorize';

export * from './analytics/period';
