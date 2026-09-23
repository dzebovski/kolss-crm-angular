import { safeAppReturnTo } from './safe-return-to';

describe('safeAppReturnTo', () => {
  it('keeps canonical protected destinations with query parameters and fragments', () => {
    expect(safeAppReturnTo('/leads/lead-1?office=warsaw#activity')).toBe(
      '/leads/lead-1?office=warsaw#activity',
    );
  });

  it('normalizes legacy CRM destinations', () => {
    expect(safeAppReturnTo('/crm/calendar?office=kyiv#today')).toBe('/calendar?office=kyiv#today');
    expect(safeAppReturnTo('/crm')).toBe('/leads');
  });

  it('rejects external, public, and lookalike paths', () => {
    expect(safeAppReturnTo('https://example.com/leads')).toBe('/dashboard');
    expect(safeAppReturnTo('/login')).toBe('/dashboard');
    expect(safeAppReturnTo('/leads-export')).toBe('/dashboard');
  });
});
