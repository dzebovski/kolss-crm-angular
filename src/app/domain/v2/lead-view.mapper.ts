import { formatPhoneDisplay } from '@core/phone/phone';
import type { CallStatus, ClientStatus, Lead, LeadSource } from '@domain/lead.types';
import type {
  V2LeadChannel,
  V2LeadDisplayStatus,
  V2LeadListItem,
  V2LegacyLeadStatus,
} from './lead-view.types';

export interface V2LeadMapContext {
  /** Display name of an active manager, or null when unknown or inactive. */
  readonly managerName: (managerId: string) => string | null;
}

export function toV2LeadListItem(lead: Lead, context: V2LeadMapContext): V2LeadListItem {
  const latest = lead.latestTimelineComment;
  return {
    id: lead.id,
    code: lead.referenceId.toUpperCase(),
    name: lead.name,
    phone: formatPhoneDisplay(lead.phone, lead.officeCode),
    status: deriveV2LeadStatus(lead.clientStatus, lead.callStatus),
    // TODO(W2): read the rating field once the API exposes it.
    rating: null,
    // TODO(W3): read the channel field once the API exposes it.
    channel: channelFromSource(lead.source),
    officeId: lead.officeCode,
    managerId: lead.assignedToId,
    managerName: lead.assignedToId ? context.managerName(lead.assignedToId) : null,
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

/** v1 `source` → v2 channel. `other` has no v2 channel yet (logged as a design gap). */
export function channelFromSource(source: LeadSource): V2LeadChannel | null {
  switch (source) {
    case 'website':
      return 'website';
    case 'facebook':
      return 'meta_ads';
    case 'office':
      return 'office';
    case 'other':
      return null;
  }
}
