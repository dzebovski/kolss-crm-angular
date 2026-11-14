import {
  v2EstimateFormChange,
  v2EstimateFormError,
  v2EstimateFormInitial,
} from './project-estimate-form';
import type { V2Money } from './project.types';

const stored: V2Money = { amount: 40000, currency: 'PLN' };

describe('v2EstimateFormChange', () => {
  it('sends a changed total and clears an emptied stored one', () => {
    const initial = v2EstimateFormInitial(stored, 'PLN', 'pl');
    expect(v2EstimateFormChange({ ...initial, amount: '12 000,5' }, initial, stored)).toEqual({
      amount: 12000.5,
      currency: 'PLN',
    });
    expect(v2EstimateFormChange({ ...initial, amount: '' }, initial, stored)).toEqual({
      amount: null,
    });
  });

  it('sends nothing for an untouched form or an empty one without a stored estimate', () => {
    const initial = v2EstimateFormInitial(stored, 'PLN', 'en');
    expect(v2EstimateFormChange({ ...initial }, initial, stored)).toBeNull();
    const empty = v2EstimateFormInitial(null, 'UAH', 'uk');
    expect(v2EstimateFormChange({ ...empty, currency: 'EUR' }, empty, null)).toBeNull();
  });
});

describe('v2EstimateFormError', () => {
  it('flags only a malformed amount', () => {
    expect(v2EstimateFormError({ amount: 'abc', currency: 'PLN' })).toBe('amountInvalid');
    expect(v2EstimateFormError({ amount: '', currency: 'PLN' })).toBeNull();
    expect(v2EstimateFormError({ amount: '1000', currency: 'PLN' })).toBeNull();
  });
});
