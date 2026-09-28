import type { CreateLeadRequest } from '@core/api/generated/kolss-api.types';
import { OFFICE_CONFIG } from '@core/office/office.config';
import type { OfficeId } from '@domain/office.types';
import type { V2LeadChannel } from '@domain/v2/lead-view.types';

export type V2CreateLeadChannel = Exclude<V2LeadChannel, 'other'>;

export function v2CreateLeadLocalDateTime(
  now: Date,
  office: OfficeId,
): { readonly date: string; readonly time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: OFFICE_CONFIG[office].timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .filter((part) => ['year', 'month', 'day', 'hour', 'minute'].includes(part.type))
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts['year']}-${parts['month']}-${parts['day']}`,
    time: `${parts['hour']}:${parts['minute']}`,
  };
}

export function v2CreateLeadLegacySource(
  channel: V2CreateLeadChannel,
): CreateLeadRequest['source'] {
  if (channel === 'website') return 'website';
  if (channel === 'meta_ads') return 'facebook';
  if (channel === 'office') return 'office';
  return 'other';
}
