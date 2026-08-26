/**
 * @ed/core - dominio di Economia Domestica.
 *
 * Regola del package: nessuna dipendenza da React, Next, Supabase o dal DOM.
 * Tutto qui dentro deve essere eseguibile in un test senza browser e senza
 * database. È la parte che sopravvive a un cambio di frontend o di backend.
 */

export * from './money.js';
export * from './units.js';

export * from './receipt/draft.js';
export * from './receipt/validate.js';
export * from './receipt/prepare.js';

export * from './matching/normalize.js';
export * from './matching/similarity.js';
export * from './matching/resolve.js';

export * from './taxonomy/categories.js';
export * from './taxonomy/categorize.js';

export * from './analytics/period.js';
