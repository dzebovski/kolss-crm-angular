import { dashboardManagers } from './manager-tasks.rules';

const base = (id: string, displayName: string, officeUuids = ['office-1']) => ({
  id,
  email: null,
  displayName,
  role: 'office_member' as const,
  officeIds: ['kyiv'] as const,
  officeUuids,
  status: 'active' as const,
  createdAt: '',
  lastActiveAt: '',
});

describe('dashboardManagers', () => {
  it('puts the signed-in manager first and filters by selected office', () => {
    const result = dashboardManagers(
      [base('other', 'A'), base('current', 'Z'), base('outside', 'Outside', ['office-2'])],
      'office-1',
      'current',
      'uk',
    );
    expect(result.map((manager) => manager.id)).toEqual(['current', 'other']);
  });

  it('drops inactive managers', () => {
    const result = dashboardManagers(
      [{ ...base('inactive', 'Inactive'), status: 'inactive' }, base('active', 'Active')],
      null,
      null,
      'uk',
    );
    expect(result.map((manager) => manager.id)).toEqual(['active']);
  });
});
