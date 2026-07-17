import { TestBed } from '@angular/core/testing';

import { KolssApiClient } from '../core/api/generated/kolss-api.client';
import { LeadActivitiesService } from './lead-activities.service';

describe('LeadActivitiesService', () => {
  const leadActivity = vi.fn(async (leadId: string, payload: unknown) => {
    void leadId;
    void payload;
    return { ok: true, version: 2 };
  });
  let service: LeadActivitiesService;

  beforeEach(() => {
    leadActivity.mockClear();
    TestBed.configureTestingModule({
      providers: [
        LeadActivitiesService,
        { provide: KolssApiClient, useValue: { leadActivity } },
      ],
    });
    service = TestBed.inject(LeadActivitiesService);
  });

  it('sends each call status as a typed activity', async () => {
    await service.recordCall('lead-1', 'reached', '  Погодили зустріч  ');
    await service.recordCall('lead-1', 'no_answer');
    await service.recordCall('lead-1', 'callback_requested');
    expect(leadActivity.mock.calls.map((call) => call[1])).toEqual([
      { type: 'call_status', status: 'reached', comment: 'Погодили зустріч' },
      { type: 'call_status', status: 'no_answer' },
      { type: 'call_status', status: 'callback_requested' },
    ]);
  });

  it('sends comment, close, contract and reopen payloads', async () => {
    await service.addComment('lead-1', '  Нова нотатка  ');
    await service.closeLead('lead-1', 'expensive', '  Не вкладається в бюджет  ');
    await service.signContract('lead-1', '  K-42  ', 1200, 'EUR');
    await service.reopen('lead-1');
    expect(leadActivity.mock.calls.map((call) => call[1])).toEqual([
      { type: 'comment', comment: 'Нова нотатка' },
      {
        type: 'client_status',
        status: 'closed_lost',
        reason: 'expensive',
        comment: 'Не вкладається в бюджет',
      },
      {
        type: 'client_status',
        status: 'contract_signed',
        contractNumber: 'K-42',
        amount: 1200,
        currency: 'EUR',
      },
      { type: 'reopen' },
    ]);
  });
});
