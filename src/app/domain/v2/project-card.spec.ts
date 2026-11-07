import type { V2Money } from './project.types';
import { v2ContractBar, v2ProjectDay, v2ProjectRestoreStatus } from './project-card';

const pln = (amount: number): V2Money => ({ amount, currency: 'PLN' });

describe('v2ProjectDay', () => {
  it('builds a local date without a UTC shift', () => {
    const day = v2ProjectDay('2026-09-29');
    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([2026, 8, 29]);
  });
});

describe('v2ProjectRestoreStatus', () => {
  it('returns the status held before cancelling, or estimate', () => {
    expect(v2ProjectRestoreStatus({ previousStatus: 'design' })).toBe('design');
    expect(v2ProjectRestoreStatus({ previousStatus: null })).toBe('estimate');
  });
});

describe('v2ContractBar', () => {
  it('splits the main contract into the credited intro and its own payments', () => {
    expect(v2ContractBar({ total: pln(40000), credited: pln(1000), paid: pln(15000) })).toEqual({
      credited: 2.5,
      paid: 37.5,
    });
  });

  it('never exceeds the total and is empty without a total', () => {
    expect(v2ContractBar({ total: pln(100), credited: pln(30), paid: pln(90) })).toEqual({
      credited: 30,
      paid: 70,
    });
    expect(v2ContractBar({ total: pln(0), credited: pln(0), paid: pln(0) })).toEqual({
      credited: 0,
      paid: 0,
    });
  });
});
