import {
  callStatusTone,
  clientStatusTone,
  commentDueAtForLead,
  showroomDueAtForLead,
} from './crm-mock.helpers';

describe('CRM status tones', () => {
  it('maps every call result to the shared semantic palette', () => {
    expect([
      callStatusTone('reached'),
      callStatusTone('no_answer'),
      callStatusTone('callback_requested'),
      callStatusTone(null),
    ]).toEqual(['success', 'danger', 'brand', 'neutral']);
  });

  it('maps every client status to the shared semantic palette', () => {
    expect([
      clientStatusTone('new_lead'),
      clientStatusTone('showroom_invited'),
      clientStatusTone('calculation_in_progress'),
      clientStatusTone('thinking'),
      clientStatusTone('closed_lost'),
      clientStatusTone('contract_signed'),
    ]).toEqual(['brand', 'info', 'warning', 'brand', 'danger', 'success']);
  });
});

describe('independent due dates', () => {
  const base = {
    callbackDueAt: '2026-08-03T12:00:00.000Z',
    commentReminderDueAt: '2026-08-06T12:00:00.000Z',
  };

  it('returns showroom and comment dates independently', () => {
    expect(
      showroomDueAtForLead({
        ...base,
        showroomDueAt: '2026-08-05T12:00:00.000Z',
      }),
    ).toBe('2026-08-05T12:00:00.000Z');
    expect(commentDueAtForLead(base)).toBe('2026-08-06T12:00:00.000Z');
  });

  it('does not resurrect a stale comment reminder when the API returns null', () => {
    expect(commentDueAtForLead({ commentReminderDueAt: null })).toBeNull();
  });

  it('supports the legacy callback context for showroom dates', () => {
    expect(
      showroomDueAtForLead({
        ...base,
        callbackDueContext: { category: 'client_status', statusCode: 'showroom_invited' },
      }),
    ).toBe(base.callbackDueAt);
  });
});
