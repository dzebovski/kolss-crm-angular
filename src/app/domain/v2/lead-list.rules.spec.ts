import { OFFICE_CONFIG } from '@core/office/office.config';
import { groupV2LeadsByMonth, v2Initials } from './lead-list.rules';
import type { V2LeadListItem } from './lead-view.types';
import { v2PluralCategory } from './plural';

function lead(id: string, createdAt: string): V2LeadListItem {
  return {
    id,
    code: 'K0001',
    name: 'Anna Melnyk',
    phone: '',
    status: 'new',
    rating: null,
    channel: 'office',
    officeId: OFFICE_CONFIG.kyiv.id,
    managerId: null,
    managerName: null,
    createdAt,
    lastComment: null,
  };
}

describe('groupV2LeadsByMonth', () => {
  it('sorts newest first and groups by local calendar month', () => {
    const groups = groupV2LeadsByMonth([
      lead('a', new Date(2026, 7, 28, 16, 40).toISOString()),
      lead('b', new Date(2026, 8, 23, 10, 42).toISOString()),
      lead('c', new Date(2026, 8, 3, 11, 0).toISOString()),
      lead('d', new Date(2025, 8, 1, 9, 0).toISOString()),
    ]);
    expect(groups.map((group) => group.key)).toEqual(['2026-09', '2026-08', '2025-09']);
    expect(groups[0].items.map((item) => item.id)).toEqual(['b', 'c']);
  });
});

describe('v2Initials', () => {
  it('takes the first letters of the first two words', () => {
    expect(v2Initials('Iryna  Bondar')).toBe('IB');
    expect(v2Initials('paweł mazur kowalski')).toBe('PM');
  });
});

describe('v2PluralCategory', () => {
  it('maps uk and pl counts to one / few / many', () => {
    expect([1, 2, 5, 21, 22, 25].map((n) => v2PluralCategory('uk', n))).toEqual([
      'one',
      'few',
      'many',
      'one',
      'few',
      'many',
    ]);
    expect([1, 3, 12, 22].map((n) => v2PluralCategory('pl', n))).toEqual([
      'one',
      'few',
      'many',
      'few',
    ]);
    expect([1, 2].map((n) => v2PluralCategory('en', n))).toEqual(['one', 'other']);
  });
});
