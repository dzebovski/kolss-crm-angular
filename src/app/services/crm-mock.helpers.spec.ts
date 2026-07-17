import { callStatusTone, clientStatusTone } from './crm-mock.helpers';

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
