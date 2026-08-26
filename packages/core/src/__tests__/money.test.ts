import { describe, expect, it } from 'vitest';
import {
  fromCents,
  lineAmountCents,
  percentChange,
  roundQuantity,
  roundUnitPrice,
  sumCents,
  toCents,
  totalToleranceCents,
} from '../money.js';

describe('money', () => {
  it('converte euro in centesimi senza errori di virgola mobile', () => {
    expect(toCents(1.29)).toBe(129);
    expect(toCents(0.1)).toBe(10);
    expect(toCents(1.005)).toBe(101);
    expect(toCents(12.44)).toBe(1244);
  });

  it('somma in centesimi senza accumulare errore', () => {
    // In float, 0.1 + 0.2 + 0.3 non fa 0.6.
    const cents = [0.1, 0.2, 0.3].map(toCents);
    expect(sumCents(cents)).toBe(60);
    expect(fromCents(sumCents(cents))).toBe(0.6);
  });

  it('calcola l importo riga arrotondando una volta sola, come la cassa', () => {
    // 0,482 kg x 3,90 EUR/kg = 1,8798 -> 1,88
    expect(lineAmountCents(0.482, 3.9)).toBe(188);
    // 0,310 kg x 26,90 EUR/kg = 8,339 -> 8,34
    expect(lineAmountCents(0.31, 26.9)).toBe(834);
  });

  it('arrotonda prezzi unitari a 4 decimali e quantita a 3', () => {
    expect(roundUnitPrice(0.029512)).toBe(0.0295);
    expect(roundQuantity(0.4823)).toBe(0.482);
  });

  it('fa crescere la tolleranza sul totale col numero di righe', () => {
    expect(totalToleranceCents(2)).toBe(5);
    expect(totalToleranceCents(40)).toBe(20);
  });

  it('non produce infiniti quando la base del confronto e zero', () => {
    expect(percentChange(1000, 0)).toBeNull();
    expect(percentChange(1200, 1000)).toBeCloseTo(20);
    expect(percentChange(800, 1000)).toBeCloseTo(-20);
  });
});
