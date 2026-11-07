import {
  v2EstimateErrorCount,
  v2EstimateFormChanges,
  v2EstimateFormErrors,
  v2EstimateFormInitial,
  v2EstimateFormTotals,
} from './project-estimate-form';
import type { V2ProjectEstimate } from './project.types';

const stored: V2ProjectEstimate = {
  lines: {
    kitchen: { money: { amount: 40000, currency: 'PLN' }, note: 'Island' },
    appliances: null,
    installation: null,
    countertop: null,
  },
  totals: [{ amount: 40000, currency: 'PLN' }],
  locked: false,
};

describe('v2EstimateFormChanges', () => {
  it('sends only changed lines and removes an emptied stored line', () => {
    const initial = v2EstimateFormInitial(stored, 'PLN', 'pl');
    const form = structuredClone(initial);
    form.kitchen.amount = '';
    form.kitchen.note = '';
    form.appliances.amount = '12 000,5';
    expect(v2EstimateFormChanges(form, initial, stored)).toEqual({
      kitchen: null,
      appliances: { amount: 12000.5, currency: 'PLN', note: null },
    });
  });

  it('sends nothing for a new project with empty lines', () => {
    const initial = v2EstimateFormInitial(null, 'UAH', 'uk');
    expect(v2EstimateFormChanges(structuredClone(initial), initial, null)).toEqual({});
  });
});

describe('v2EstimateFormErrors', () => {
  it('flags a bad amount and a note without an amount', () => {
    const form = v2EstimateFormInitial(null, 'PLN', 'en');
    form.kitchen.amount = 'abc';
    form.countertop.note = 'Quartz';
    const errors = v2EstimateFormErrors(form);
    expect(errors).toEqual({
      kitchen: { amount: 'amountInvalid' },
      countertop: { amount: 'noteWithoutAmount' },
    });
    expect(v2EstimateErrorCount(errors)).toBe(2);
  });
});

describe('v2EstimateFormTotals', () => {
  it('sums per currency', () => {
    const form = v2EstimateFormInitial(null, 'PLN', 'en');
    form.kitchen.amount = '1000';
    form.appliances.amount = '500.5';
    form.countertop.amount = '200';
    form.countertop.currency = 'EUR';
    expect(v2EstimateFormTotals(form)).toEqual([
      { amount: 1500.5, currency: 'PLN' },
      { amount: 200, currency: 'EUR' },
    ]);
  });
});
