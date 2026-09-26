import { FIXTURE_LEADS } from '@testing/fixtures/leads.fixture';
import { v2LeadColumnsFromRow } from './lead-card.mapper';
import {
  channelFromSource,
  deriveV2LeadStatus,
  isV2LegacyLeadStatus,
  toV2LeadListItem,
} from './lead-view.mapper';

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

describe('toV2LeadListItem', () => {
  const lead = FIXTURE_LEADS[0];

  it('prefers the v2 columns (rating, channel, v2Status) over the v1 fallback', () => {
    const columns = v2LeadColumnsFromRow({
      v2_status: 'invited',
      rating: 'hot',
      channel: 'referral',
    });
    const item = toV2LeadListItem(lead, columns);
    expect(item.status).toBe('invited');
    expect(item.rating).toBe('hot');
    expect(item.channel).toBe('referral');
    expect(item.managerName).toBeNull();
  });

  it('falls back to the v1-derived status and source channel when the v2 columns are unset', () => {
    const columns = v2LeadColumnsFromRow({});
    const item = toV2LeadListItem(lead, columns);
    expect(item.status).toBe(deriveV2LeadStatus(lead.clientStatus, lead.callStatus));
    expect(item.rating).toBeNull();
    expect(item.channel).toBe(channelFromSource(lead.source));
  });
});
