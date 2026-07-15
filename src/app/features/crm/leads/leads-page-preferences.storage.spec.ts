import {
  DEFAULT_LEADS_PAGE_PREFERENCES,
  LEADS_PAGE_PREFERENCES_STORAGE_KEY,
  readLeadsPagePreferences,
  writeLeadsPagePreferences,
} from './leads-page-preferences.storage';

describe('leads-page-preferences.storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns defaults when nothing is stored', () => {
    expect(readLeadsPagePreferences()).toEqual(DEFAULT_LEADS_PAGE_PREFERENCES);
  });

  it('returns defaults for invalid JSON', () => {
    localStorage.setItem(LEADS_PAGE_PREFERENCES_STORAGE_KEY, '{not-json');
    expect(readLeadsPagePreferences()).toEqual(DEFAULT_LEADS_PAGE_PREFERENCES);
  });

  it('returns defaults for invalid preference values', () => {
    localStorage.setItem(
      LEADS_PAGE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ periodDays: 99, workflowFilter: 'unknown' }),
    );
    expect(readLeadsPagePreferences()).toEqual(DEFAULT_LEADS_PAGE_PREFERENCES);
  });

  it('reads valid preferences including null period and null filter', () => {
    const prefs = { periodDays: null, workflowFilter: 'visit' as const };
    localStorage.setItem(LEADS_PAGE_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
    expect(readLeadsPagePreferences()).toEqual(prefs);
  });

  it('writes and reads preferences round-trip', () => {
    const prefs = { periodDays: 30, workflowFilter: 'closed' as const };
    writeLeadsPagePreferences(prefs);
    expect(readLeadsPagePreferences()).toEqual(prefs);
    expect(localStorage.getItem(LEADS_PAGE_PREFERENCES_STORAGE_KEY)).toBe(JSON.stringify(prefs));
  });

  it('uses partial defaults when only one field is valid', () => {
    localStorage.setItem(
      LEADS_PAGE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ periodDays: 180, workflowFilter: 'nope' }),
    );
    expect(readLeadsPagePreferences()).toEqual({
      periodDays: 180,
      workflowFilter: null,
    });
  });
});
