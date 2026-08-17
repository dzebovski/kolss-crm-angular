import { convertToParamMap } from '@angular/router';

import {
  leadsPageQueryStateFromPreferences,
  parseLeadsPageQuery,
  serializeLeadsPageQuery,
  type LeadsPageQueryState,
} from './leads-page-query-params';
import { DEFAULT_LEADS_PAGE_PREFERENCES } from './leads-page-preferences.storage';

describe('leads page query params', () => {
  const parse = (params: Record<string, string>) => parseLeadsPageQuery(convertToParamMap(params));
  const emptyState: LeadsPageQueryState = {
    office: null,
    periodDays: 7,
    callStatusFilter: [],
    clientStatusFilter: [],
    managerFilter: '',
    query: '',
    showArchived: false,
  };

  it('returns null when the URL carries no leads filter', () => {
    expect(parse({})).toBeNull();
    expect(parse({ tab: 'leads' })).toBeNull();
  });

  it('parses a shared office and status link', () => {
    expect(parse({ office: 'warsaw', clientStatus: 'new_lead,in_work', days: '30' })).toEqual({
      office: 'warsaw',
      periodDays: 30,
      callStatusFilter: [],
      clientStatusFilter: ['new_lead', 'in_work'],
      managerFilter: '',
      query: '',
      showArchived: false,
    });
  });

  it('falls back to the page defaults for keys the link omits', () => {
    const state = parse({ clientStatus: 'new_lead' });

    expect(state?.periodDays).toBe(DEFAULT_LEADS_PAGE_PREFERENCES.periodDays);
    expect(state?.callStatusFilter).toEqual([]);
    expect(state?.managerFilter).toBe('');
  });

  it('drops unknown offices, statuses and periods instead of failing', () => {
    expect(
      parse({
        office: 'berlin',
        clientStatus: 'new_lead,not_a_status',
        callStatus: 'nope',
        days: '999',
      }),
    ).toEqual({
      office: null,
      periodDays: DEFAULT_LEADS_PAGE_PREFERENCES.periodDays,
      callStatusFilter: [],
      clientStatusFilter: ['new_lead'],
      managerFilter: '',
      query: '',
      showArchived: false,
    });
  });

  it('maps the all-time period to days=all in both directions', () => {
    expect(parse({ days: 'all' })?.periodDays).toBeNull();
    expect(serializeLeadsPageQuery({ ...emptyState, periodDays: null })['days']).toBe('all');
  });

  it('omits empty filters from the link but always keeps the period', () => {
    expect(serializeLeadsPageQuery(emptyState)).toEqual({ days: '7' });
  });

  it('round-trips a fully populated state', () => {
    const state: LeadsPageQueryState = {
      office: 'all',
      periodDays: 180,
      callStatusFilter: ['no_answer'],
      clientStatusFilter: ['new_lead', 'thinking'],
      managerFilter: 'emp-kyiv-1',
      query: 'kowalski',
      showArchived: true,
    };

    expect(parse(serializeLeadsPageQuery(state))).toEqual(state);
  });

  it('builds a link-shaped state from stored preferences', () => {
    expect(
      leadsPageQueryStateFromPreferences({
        periodDays: 40,
        callStatusFilter: ['reached'],
        clientStatusFilter: [],
        managerFilter: 'emp-kyiv-1',
      }),
    ).toEqual({
      office: null,
      periodDays: 40,
      callStatusFilter: ['reached'],
      clientStatusFilter: [],
      managerFilter: 'emp-kyiv-1',
      query: '',
      showArchived: false,
    });
  });
});
