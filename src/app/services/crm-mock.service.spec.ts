import { CRM_MOCK_LEADS } from './crm-mock.data';
import {
  calculateFunnel,
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
    expect(validateCloseLead({ reason: 'lost_client', comment: '' })).toContain('коментар');
    expect(validateCloseLead({ reason: 'expensive', comment: '' })).toBeNull();
    expect(
      validateSuccessfulLead({ contractNumber: '', amount: 1000, prepayment: null, comment: '' }),
    ).toContain('номер');
  });

  it('calculates funnel metrics from leads', () => {
    const funnel = calculateFunnel(CRM_MOCK_LEADS, 40);
    expect(funnel[0]?.count).toBeGreaterThan(0);
    expect(funnel.some((stage) => stage.key === 'successful')).toBe(true);
  });

  it('maps legacy workflow statuses to simplified model', () => {
    expect(toSimplifiedWorkflowStatus('showroom_scheduled')).toBe('visit_scheduled');
    expect(toSimplifiedWorkflowStatus('bad_lead')).toBe('closed');
    expect(toSimplifiedWorkflowStatus('taken')).toBe('taken');
  });
});
