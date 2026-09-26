import { formatPhoneDisplay } from '@core/phone/phone';
import type { CallStatus, ClientStatus, Lead, LeadSource } from '@domain/lead.types';
import type { V2LeadColumns } from './lead-card.types';
import type {
  V2LeadChannel,
  V2LeadDisplayStatus,
  V2LeadListItem,
  V2LegacyLeadStatus,
} from './lead-view.types';

/**
 * `lead` and `columns` come from the same raw `GET /v1/leads` row (v1 fields mapped by
 * `mapLeadListRow`, v2 columns read by `v2LeadColumnsFromRow`; the v2 leads list service
 * combines them, mirroring `toV2LeadCard`). `managerName` is resolved separately by the page
 * from the employees list (as v1), so it always starts `null` here.
 */
export function toV2LeadListItem(lead: Lead, columns: V2LeadColumns): V2LeadListItem {
  const latest = lead.latestTimelineComment;
  return {
    id: lead.id,
    code: lead.referenceId.toUpperCase(),
    name: lead.name,
    phone: formatPhoneDisplay(lead.phone, lead.officeCode),
    status: columns.v2Status ?? deriveV2LeadStatus(lead.clientStatus, lead.callStatus),
    rating: columns.rating,
    channel: columns.channel ?? channelFromSource(lead.source),
    officeId: lead.officeCode,
    managerId: lead.assignedToId,
    managerName: null,
    createdAt: lead.sourceCreatedAt,
    lastComment: latest ? { text: latest.comment, at: latest.occurredAt } : null,
  };
}

const LEGACY_CLIENT_STATUSES: ReadonlySet<ClientStatus> = new Set<V2LegacyLeadStatus>([
  'measurement_scheduled',
  'calculation_in_progress',
  'postponed',
  'contract_signed',
]);

export function isV2LegacyLeadStatus(status: V2LeadDisplayStatus): status is V2LegacyLeadStatus {
  return LEGACY_CLIENT_STATUSES.has(status as ClientStatus);
}

/**
 * Until W5 stores the v2 status, derive it from the v1 fields with the 1:1
 * mapping of decision D1b: a client status beyond `new_lead` wins, then the
 * call result, else `new`. Legacy client statuses pass through (D1c).
 */
export function deriveV2LeadStatus(
  clientStatus: ClientStatus,
  callStatus: CallStatus | null,
): V2LeadDisplayStatus {
  switch (clientStatus) {
    case 'showroom_invited':
      return 'invited';
    case 'thinking':
      return 'thinking';
    case 'closed_lost':
      return 'lost';
    case 'measurement_scheduled':
    case 'calculation_in_progress':
    case 'postponed':
    case 'contract_signed':
      return clientStatus;
    case 'new_lead':
      break;
  }
  switch (callStatus) {
    case 'callback_requested':
      return 'later';
    case 'no_answer':
      return 'noanswer';
    case 'reached':
      return 'success';
    case null:
      return 'new';
  }
}

/**
 * v1 `source` → v2 channel. v1 already maps manually created leads to `office`;
 * v2 keeps that until W3 (user decision 2026-09-24).
 */
export function channelFromSource(source: LeadSource): V2LeadChannel {
  switch (source) {
    case 'website':
      return 'website';
    case 'facebook':
      return 'meta_ads';
    case 'office':
      return 'office';
    case 'other':
      return 'other';
  }
}
