import { hasOfficeLeadFilter } from './roles';

describe('hasOfficeLeadFilter', () => {
  it('allows super admins, curators and office admins', () => {
    expect(hasOfficeLeadFilter('super_admin')).toBe(true);
    expect(hasOfficeLeadFilter('curator')).toBe(true);
    expect(hasOfficeLeadFilter('office_admin')).toBe(true);
  });

  it('denies office members and missing roles', () => {
    expect(hasOfficeLeadFilter('office_member')).toBe(false);
    expect(hasOfficeLeadFilter(null)).toBe(false);
  });
});
