import { TestBed } from '@angular/core/testing';

import {
  calculateFunnel,
  groupLeadsByYearMonth,
  matchesLeadSearch,
  validateCloseLead,
  validateSuccessfulLead,
} from './crm-mock.helpers';
import { CrmMockService } from './crm-mock.service';

describe('CrmMockService', () => {
  let service: CrmMockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CrmMockService);
    service.reset();
  });

  it('provides the requested mock users and leads', () => {
    expect(service.leads()).toHaveLength(10);
    expect(service.employees().filter((employee) => employee.role === 'super_admin')).toHaveLength(
      1,
    );
    expect(service.employees().filter((employee) => employee.role === 'curator')).toHaveLength(1);
    expect(service.employees().filter((employee) => employee.role === 'office_admin')).toHaveLength(
      1,
    );
    expect(
      service
        .employees()
        .filter(
          (employee) => employee.role === 'office_member' && employee.officeIds.includes('warsaw'),
        ),
    ).toHaveLength(3);
    expect(
      service
        .employees()
        .filter(
          (employee) => employee.role === 'office_member' && employee.officeIds.includes('kyiv'),
        ),
    ).toHaveLength(3);
  });

  it('searches and groups leads by year and month', () => {
    const matching = service.leads().filter((lead) => matchesLeadSearch(lead, 'Марина'));
    expect(matching.map((lead) => lead.id)).toEqual(['lead-1001']);

    const groups = groupLeadsByYearMonth(service.leads());
    expect(groups[0].key).toBe('2026-07');
    expect(groups.some((group) => group.key === '2025-12')).toBe(true);
  });

  it('validates close and successful lead payloads', () => {
    expect(validateCloseLead({ reason: 'lost_client', comment: '' })).toContain('коментар');
    expect(validateCloseLead({ reason: 'expensive', comment: '' })).toBeNull();
    expect(
      validateSuccessfulLead({ contractNumber: '', amount: 1000, prepayment: null, comment: '' }),
    ).toContain('номер');
    expect(
      validateSuccessfulLead({
        contractNumber: 'K-1',
        amount: 0,
        prepayment: null,
        comment: '',
      }),
    ).toContain('більше нуля');
  });

  it('applies local workflow transitions and report aggregation', () => {
    service.takeLead('lead-1001');
    expect(service.leadById('lead-1001')?.workflowStatus).toBe('taken');

    const firstCallError = service.recordFirstCall(
      'lead-1001',
      'Потреба підтверджена',
      'Готова до візиту.',
    );
    expect(firstCallError).toBeNull();
    expect(service.leadById('lead-1001')?.firstCall?.result).toBe('Потреба підтверджена');

    const closeError = service.closeLead('lead-1001', {
      reason: 'lost_client',
      comment: 'Обрала іншого виробника.',
    });
    expect(closeError).toBeNull();
    expect(service.leadById('lead-1001')?.leadStatus).toBe('failed');
    expect(service.leadById('lead-1001')?.events[0].type).toBe('closed');

    const funnel = calculateFunnel(service.leads(), 40);
    expect(funnel[0].count).toBeGreaterThan(0);
    expect(funnel.find((stage) => stage.key === 'closed')?.count).toBeGreaterThan(0);
  });
});
