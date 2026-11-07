import type { V2Money } from './project.types';
import {
  v2AmountText,
  v2IsFutureDay,
  v2IsPastDay,
  v2ParseAmount,
  v2PaymentLimit,
  v2PaymentQuickAmounts,
} from './project-forms';

const pln = (amount: number): V2Money => ({ amount, currency: 'PLN' });

describe('v2ParseAmount', () => {
  it('reads grouped amounts with a comma or a dot', () => {
    expect(v2ParseAmount('12 000,50')).toBe(12000.5);
    expect(v2ParseAmount('12 000.5')).toBe(12000.5);
    expect(v2ParseAmount('500')).toBe(500);
  });

  it('rejects empty, zero, negative and over-precise amounts', () => {
    expect(v2ParseAmount('')).toBeNull();
    expect(v2ParseAmount('0')).toBeNull();
    expect(v2ParseAmount('-5')).toBeNull();
    expect(v2ParseAmount('1.234')).toBeNull();
    expect(v2ParseAmount('12a')).toBeNull();
  });
});

describe('v2AmountText', () => {
  it('reads back through v2ParseAmount in every locale', () => {
    for (const locale of ['en', 'uk', 'pl']) {
      expect(v2ParseAmount(v2AmountText(12000, locale))).toBe(12000);
      expect(v2ParseAmount(v2AmountText(1234.5, locale))).toBe(1234.5);
    }
  });
});

describe('v2PaymentQuickAmounts', () => {
  it('offers 500, 1000, 10% and the remaining balance for an intro contract', () => {
    const quick = v2PaymentQuickAmounts({
      kind: 'intro',
      total: pln(4000),
      paid: pln(0),
      credited: pln(0),
      remaining: pln(4000),
      target50: null,
    });
    expect(quick).toEqual([
      { kind: 'percent10', amount: 400 },
      { kind: 'fixed', amount: 500 },
      { kind: 'fixed', amount: 1000 },
      { kind: 'remaining', amount: 4000 },
    ]);
  });

  it('adds the sum up to 50% on the main contract, counting the credited intro', () => {
    const quick = v2PaymentQuickAmounts({
      kind: 'main',
      total: pln(50000),
      paid: pln(12000),
      credited: pln(1000),
      remaining: pln(37000),
      target50: pln(25000),
    });
    expect(quick.map((item) => [item.kind, item.amount])).toEqual([
      ['fixed', 500],
      ['fixed', 1000],
      ['percent10', 5000],
      ['to50', 12000],
      ['remaining', 37000],
    ]);
  });

  it('drops amounts above the balance and duplicates, and fixed amounts outside PLN', () => {
    const quick = v2PaymentQuickAmounts({
      kind: 'main',
      total: { amount: 10000, currency: 'EUR' },
      paid: { amount: 9500, currency: 'EUR' },
      credited: { amount: 0, currency: 'EUR' },
      remaining: { amount: 500, currency: 'EUR' },
      target50: { amount: 5000, currency: 'EUR' },
    });
    expect(quick).toEqual([{ kind: 'remaining', amount: 500 }]);
  });
});

describe('project popup dates and limits', () => {
  it('compares office days', () => {
    expect(v2IsFutureDay('2026-11-08', '2026-11-07')).toBe(true);
    expect(v2IsFutureDay('2026-11-07', '2026-11-07')).toBe(false);
    expect(v2IsPastDay('2026-11-06', '2026-11-07')).toBe(true);
  });

  it('lets an edited payment keep its own amount', () => {
    expect(v2PaymentLimit({ remaining: pln(37000) }, 12000)).toBe(49000);
  });
});
