import { describe, expect, it } from 'vitest';
import { normalizePrice, parsePackageSize } from '../units.js';

describe('normalizePrice', () => {
  it('lascia invariati i prezzi gia espressi al kg', () => {
    const r = normalizePrice(0.482, 'kg', 3.9);
    expect(r.unit).toBe('kg');
    expect(r.unitPrice).toBe(3.9);
    expect(r.isComparableByWeight).toBe(true);
  });

  it('converte un prezzo al pezzo in prezzo al kg quando conosce la pezzatura', () => {
    // Una busta da 500 g a 2,49 EUR costa 4,98 EUR/kg.
    const r = normalizePrice(3, 'pcs', 2.49, { size: 0.5, unit: 'kg' });
    expect(r.unit).toBe('kg');
    expect(r.unitPrice).toBe(4.98);
    expect(r.quantity).toBe(1.5);
    expect(r.isComparableByWeight).toBe(true);
  });

  it('dichiara non confrontabile un prezzo al pezzo senza pezzatura', () => {
    const r = normalizePrice(2, 'pcs', 1.29);
    expect(r.unit).toBe('pcs');
    expect(r.isComparableByWeight).toBe(false);
  });
});

describe('parsePackageSize', () => {
  it('legge le pezzature semplici', () => {
    expect(parsePackageSize('PMD LATTE PS 1L')).toEqual({ size: 1, unit: 'l' });
    expect(parsePackageSize('PASTA 500 GR')).toEqual({ size: 0.5, unit: 'kg' });
    expect(parsePackageSize('PASSATA 700ML')).toEqual({ size: 0.7, unit: 'l' });
  });

  it('legge le pezzature multiple', () => {
    expect(parsePackageSize('YOGURT 4x125g')).toEqual({ size: 0.5, unit: 'kg' });
    expect(parsePackageSize('ACQUA 6X1,5 LT')).toEqual({ size: 9, unit: 'l' });
  });

  it('restituisce null quando non c e nulla di affidabile', () => {
    expect(parsePackageSize('POMOD.CILIEG.')).toBeNull();
    expect(parsePackageSize('PARMIGIANO REGG.24M')).toBeNull();
  });

  it('scarta le pezzature implausibili invece di inventarle', () => {
    expect(parsePackageSize('OFFERTA 500 KG')).toBeNull();
  });
});
