import { CRM_MOCK_EMPLOYEES, CRM_MOCK_LEADS } from './crm-mock.data';
import {
  calculateFunnel,
  calculateManagerTakenReport,
  groupLeadsByYearMonth,
  matchesLeadSearch,
  validateCloseLead,
  validateSuccessfulLead,
} from './crm-mock.helpers';
import { toSimplifiedWorkflowStatus } from './workflow-legacy.mapper';

describe('crm helpers', () => {
  it('searches and groups leads by year and month', () => {
    const matching = CRM_MOCK_LEADS.filter((lead) => matchesLeadSearch(lead, 'Марина'));
    expect(matching.map((lead) => lead.id)).toEqual(['lead-1001']);

    const groups = groupLeadsByYearMonth(CRM_MOCK_LEADS);
    expect(groups[0].key).toBe('2026-07');
    expect(groups.some((group) => group.key === '2025-12')).toBe(true);
  });

  it('validates close and successful lead payloads', () => {
    expect(validateCloseLead({ reason: 'lost_client', comment: '' })).toBe('validation.lostClientComment');
    expect(validateCloseLead({ reason: 'expensive', comment: '' })).toBeNull();
    expect(
      validateSuccessfulLead({ contractNumber: '', amount: 1000, prepayment: null, comment: '' }),
    ).toBe('validation.contractNumber');
  });

  it('calculates funnel metrics from leads', () => {
    const funnel = calculateFunnel(CRM_MOCK_LEADS, 40);
    expect(funnel[0]?.count).toBeGreaterThan(0);

    const byKey = new Map(funnel.map((stage) => [stage.key, stage] as const));
    const stage = (key: string) => {
      const value = byKey.get(key);
      expect(value).toBeTruthy();
      return value!;
    };
    const pct = (count: number, base: number) => (base ? Math.round((count / base) * 100) : 0);

    const created = stage('created');
    const taken = stage('taken');
    const scheduled = stage('scheduled');
    const visited = stage('visited');
    const successful = stage('successful');
    const closed = stage('closed');

    expect(created.conversionFromPrevious).toBe(0);
    expect(created.conversionBaseLabel).toBeNull();
    expect(taken.conversionFromPrevious).toBe(pct(taken.count, created.count));
    expect(taken.conversionBaseLabel).toBe('funnel.created');
    expect(scheduled.conversionFromPrevious).toBe(pct(scheduled.count, taken.count));
    expect(scheduled.conversionBaseLabel).toBe('funnel.taken');
    expect(visited.conversionFromPrevious).toBe(pct(visited.count, scheduled.count));
    expect(visited.conversionBaseLabel).toBe('funnel.scheduled');
    expect(successful.conversionFromPrevious).toBe(pct(successful.count, taken.count));
    expect(successful.conversionBaseLabel).toBe('funnel.taken');
    expect(closed.conversionFromPrevious).toBe(pct(closed.count, taken.count));
    expect(closed.conversionBaseLabel).toBe('funnel.taken');
  });

  it('calculates manager taken report per office', () => {
    const kyiv = calculateManagerTakenReport(CRM_MOCK_LEADS, CRM_MOCK_EMPLOYEES, 'kyiv', 40);
    const warsaw = calculateManagerTakenReport(CRM_MOCK_LEADS, CRM_MOCK_EMPLOYEES, 'warsaw', 40);

    expect(kyiv.officeLabel).toBe('Київ');
    expect(warsaw.officeLabel).toBe('Варшава');
    expect(kyiv.managers.length).toBeGreaterThan(0);
    expect(warsaw.managers.length).toBeGreaterThan(0);

    const kyivMoroz = kyiv.managers.find((row) => row.managerId === 'emp-kyiv-1');
    const kyivLytvyn = kyiv.managers.find((row) => row.managerId === 'emp-kyiv-2');
    const kyivPavlenko = kyiv.managers.find((row) => row.managerId === 'emp-kyiv-3');

    expect(kyivMoroz?.takenCount).toBe(2);
    expect(kyivLytvyn?.takenCount).toBe(1);
    expect(kyivPavlenko?.takenCount).toBe(0);
    expect(kyiv.managers[0]?.takenCount).toBeGreaterThanOrEqual(kyiv.managers.at(-1)?.takenCount ?? 0);

    const warsawNowak = warsaw.managers.find((row) => row.managerId === 'emp-warsaw-1');
    expect(warsawNowak?.takenCount).toBe(2);
    expect(warsaw.unassignedCount).toBeGreaterThanOrEqual(0);
  });

  it('maps legacy workflow statuses to simplified model', () => {
    expect(toSimplifiedWorkflowStatus('showroom_scheduled')).toBe('visit_scheduled');
    expect(toSimplifiedWorkflowStatus('bad_lead')).toBe('closed');
    expect(toSimplifiedWorkflowStatus('taken')).toBe('taken');
  });
});
