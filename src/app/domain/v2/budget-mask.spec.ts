import {
  v2BudgetParts,
  v2BudgetPresets,
  v2BudgetRangeOrderInvalid,
  v2FormatBudgetInput,
  v2FormatMoneyInput,
} from './budget-mask';

describe('v2FormatMoneyInput', () => {
  it('groups digits by thousands', () => {
    expect(v2FormatMoneyInput('45000')).toBe('45 000');
  });

  it('strips non-digits and leading zeros', () => {
    expect(v2FormatMoneyInput('0045000zł')).toBe('45 000');
  });

  it('caps at 9 digits', () => {
    expect(v2FormatMoneyInput('1234567890')).toBe('123 456 789');
  });
});

describe('v2FormatBudgetInput', () => {
  it('formats a single amount (Popup-rules "45 000")', () => {
    expect(v2FormatBudgetInput('45000', '')).toBe('45 000');
  });

  it('formats a range (Popup-rules "40 000 – 50 000")', () => {
    expect(v2FormatBudgetInput('40000-50000', '')).toBe('40 000 – 50 000');
  });

  it('removes a dangling dash when the person backspaces right after it', () => {
    expect(v2FormatBudgetInput('40 000 –', '40 000 – ')).toBe('40 000');
  });
});

describe('v2BudgetParts', () => {
  it('reads both sides of a range', () => {
    expect(v2BudgetParts('40 000 – 50 000')).toEqual([40_000, 50_000]);
  });

  it('reads a single amount as the lower bound only', () => {
    expect(v2BudgetParts('45 000')).toEqual([45_000, null]);
  });
});

describe('v2BudgetRangeOrderInvalid', () => {
  it('flags an upper bound below the lower one', () => {
    expect(v2BudgetRangeOrderInvalid('40 000 – 25 000')).toBe(true);
  });

  it('accepts an ascending range', () => {
    expect(v2BudgetRangeOrderInvalid('40 000 – 50 000')).toBe(false);
  });

  it('accepts a single amount', () => {
    expect(v2BudgetRangeOrderInvalid('45 000')).toBe(false);
  });
});

describe('v2BudgetPresets', () => {
  it('formats the PLN presets (Create-lead.dc.html PRESETS.zł)', () => {
    expect(v2BudgetPresets('PLN').map((p) => p.text)).toEqual([
      '20 000 – 40 000',
      '40 000 – 60 000',
      '60 000 – 80 000',
      '80 000 – 120 000',
    ]);
  });

  it('formats the UAH presets (Create-lead.dc.html PRESETS.₴)', () => {
    expect(v2BudgetPresets('UAH').map((p) => p.text)).toEqual([
      '200 000 – 400 000',
      '400 000 – 600 000',
      '600 000 – 800 000',
      '800 000 – 1 200 000',
    ]);
  });
});
