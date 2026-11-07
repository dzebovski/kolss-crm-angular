import { describe, expect, it } from 'vitest';

import {
  v2ChangedContactFields,
  v2CreateProjectInfoChanges,
  type V2CreateProjectForm,
} from './create-project';

const FORM: V2CreateProjectForm = {
  name: 'Marta Zielińska',
  phone: '+48601334812',
  email: '',
  channel: 'website',
  referredBy: '',
  budget: '40 000 – 50 000',
  currency: 'PLN',
  location: 'Jabłonna',
  aboutClient: '',
  checklistBudget: true,
  checklistLocation: false,
  checklistPeriod: false,
  checklistMaterials: false,
  checklistProduct: true,
  clientInformed: false,
  responsibleManagerId: 'manager-1',
};

describe('v2CreateProjectInfoChanges', () => {
  it('is empty when nothing changed', () => {
    expect(v2CreateProjectInfoChanges(FORM, FORM, ['kitchen'], ['kitchen'])).toEqual({});
  });

  it('sends the checklist and no manager', () => {
    const changed = { ...FORM, clientInformed: true };
    expect(
      v2CreateProjectInfoChanges(
        { ...changed, responsibleManagerId: 'manager-2' },
        FORM,
        ['kitchen'],
        ['kitchen'],
      ),
    ).toEqual({ clientInformed: true });
  });

  it('clears the referrer when the channel is no longer a referral', () => {
    const referral = { ...FORM, channel: 'referral' as const, referredBy: 'W0123' };
    expect(v2CreateProjectInfoChanges(FORM, referral, [], [])).toEqual({ referredBy: '' });
  });

  it('sends products only when the set differs', () => {
    expect(v2CreateProjectInfoChanges(FORM, FORM, ['bathroom', 'kitchen'], ['kitchen'])).toEqual({
      products: ['bathroom', 'kitchen'],
    });
  });
});

describe('v2ChangedContactFields', () => {
  it('lists only the differing contact fields', () => {
    expect(v2ChangedContactFields(FORM, { ...FORM, email: 'a@b.pl', channel: 'phone' })).toEqual([
      'email',
      'channel',
    ]);
  });
});
