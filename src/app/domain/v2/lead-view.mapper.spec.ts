import { channelFromSource, deriveV2LeadStatus, isV2LegacyLeadStatus } from './lead-view.mapper';

describe('v2 lead view mapper', () => {
  it('derives the v2 status from v1 fields (D1b)', () => {
    expect(deriveV2LeadStatus('new_lead', null)).toBe('new');
    expect(deriveV2LeadStatus('new_lead', 'callback_requested')).toBe('later');
    expect(deriveV2LeadStatus('new_lead', 'no_answer')).toBe('noanswer');
    expect(deriveV2LeadStatus('new_lead', 'reached')).toBe('success');
    expect(deriveV2LeadStatus('thinking', 'reached')).toBe('thinking');
    expect(deriveV2LeadStatus('showroom_invited', 'reached')).toBe('invited');
    expect(deriveV2LeadStatus('closed_lost', 'no_answer')).toBe('lost');
  });

  it('passes legacy client statuses through as read-only history (D1c)', () => {
    const status = deriveV2LeadStatus('contract_signed', 'reached');
    expect(status).toBe('contract_signed');
    expect(isV2LegacyLeadStatus(status)).toBe(true);
    expect(isV2LegacyLeadStatus('success')).toBe(false);
  });

  it('maps v1 sources to v2 channels', () => {
    expect(channelFromSource('website')).toBe('website');
    expect(channelFromSource('facebook')).toBe('meta_ads');
    expect(channelFromSource('office')).toBe('office');
    expect(channelFromSource('other')).toBe('other');
  });
});
