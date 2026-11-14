import { v2AmountText, v2IsFutureDay, v2IsPastDay, v2ParseAmount } from './project-forms';

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

describe('project popup dates', () => {
  it('compares office days', () => {
    expect(v2IsFutureDay('2026-11-08', '2026-11-07')).toBe(true);
    expect(v2IsFutureDay('2026-11-07', '2026-11-07')).toBe(false);
    expect(v2IsPastDay('2026-11-06', '2026-11-07')).toBe(true);
  });
});
