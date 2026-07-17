import {
  DEFAULT_LEADS_PAGE_PREFERENCES,
  LEADS_PAGE_PREFERENCES_STORAGE_KEY,
  readLeadsPagePreferences,
  writeLeadsPagePreferences,
} from './leads-page-preferences.storage';

describe('leads-page-preferences.storage', () => {
  const values = new Map<string, string>();

  beforeAll(() => {
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      key: () => null,
      get length() { return values.size; },
    });
  });
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('returns defaults for missing or invalid data', () => {
    expect(readLeadsPagePreferences()).toEqual(DEFAULT_LEADS_PAGE_PREFERENCES);
    localStorage.setItem(LEADS_PAGE_PREFERENCES_STORAGE_KEY, '{invalid');
    expect(readLeadsPagePreferences()).toEqual(DEFAULT_LEADS_PAGE_PREFERENCES);
  });

  it('persists independent call and client status filters', () => {
    const preferences = {
      periodDays: 30,
      callStatusFilter: 'no_answer' as const,
      clientStatusFilter: 'thinking' as const,
      managerFilter: 'manager-2',
    };
    writeLeadsPagePreferences(preferences);
    expect(readLeadsPagePreferences()).toEqual(preferences);
  });

  it('does not restore the retired workflow filter', () => {
    localStorage.setItem(
      LEADS_PAGE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ periodDays: 180, workflowFilter: 'closed', managerFilter: '' }),
    );
    expect(readLeadsPagePreferences()).toEqual({
      periodDays: 180,
      callStatusFilter: null,
      clientStatusFilter: null,
      managerFilter: '',
    });
  });
});
