import { mapCreateLeadSource } from './leads.mapper';
import type { LeadSource } from './crm-mock.types';

describe('mapCreateLeadSource', () => {
  it.each<[LeadSource, string]>([
    ['office', 'office'],
    ['website', 'website'],
    ['facebook', 'facebook'],
    ['other', 'other'],
  ])('maps %s to manual/%s', (source, channel) => {
    expect(mapCreateLeadSource(source)).toEqual({
      source_system: 'manual',
      source_channel: channel,
    });
  });
});
