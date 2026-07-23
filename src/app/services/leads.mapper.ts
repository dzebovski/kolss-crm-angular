import type { Lead, Office } from '../models/database';
import { formatPhoneDisplay } from '../core/phone/phone';
import type {
  CallStatusActor,
  CloseReason,
  CallStatus,
  CallbackDueContext,
  ClientStatus,
  ContractCurrency,
  FirstCall,
  LeadClose,
  LeadContract,
  LeadEvent,
  LeadEventCategory,
  LeadEventEditAudit,
  LeadEventType,
  LeadMarker,
  LeadMarkerKind,
  LatestTimelineComment,
  LeadSource,
  LeadWorkflowStatus,
  MockLead,
  OfficeId,
  ShowroomVisit,
} from './crm-mock.types';
import { isContractCurrency, resolveCloseUserComment } from './crm-mock.helpers';
import { toSimplifiedWorkflowStatus } from './workflow-legacy.mapper';

export const LEAD_LIST_SELECT = `
  id, name, phone, email, lead_status, workflow_status,
  office_id, assigned_to, source_created_at, created_at, updated_at,
  last_comment, callback_due_at, source_system, source_channel, source_note,
  product_interest, estimated_budget, city_region, order_comment,
  offices (id, code, name_uk, name_pl),
  profiles:assigned_to (id, display_name)
`;

/** Embedded first contact attempt from GET /v1/leads (optional). */
export interface FirstContactAttemptEmbed {
  readonly result: string;
  readonly comment: string;
  readonly created_at: string;
  readonly manager_id: string;
}

/** Embedded contract summary from GET /v1/leads (optional). */
export interface ContractEmbed {
  readonly contract_number: string;
  /** API may send jsonb numeric as number or string. */
  readonly amount: number | string;
  readonly currency: string;
  readonly signed_at: string;
}

export type LeadListRow = Lead & {
  offices?: Office | Office[] | null;
  profiles?:
    | { id: string; display_name: string | null }
    | { id: string; display_name: string | null }[]
    | null;
  first_contact_attempt?: FirstContactAttemptEmbed | null;
  contract?: ContractEmbed | null;
  reactivated_at?: string | null;
  latest_timeline_comment?: LatestTimelineCommentEmbed | null;
  comment_reminder_due_at?: string | null;
  showroom_due_at?: string | null;
  callback_due_context?: CallbackDueContextEmbed | null;
  markers?: readonly LeadMarkerEmbed[] | null;
};

export interface CallbackDueContextEmbed {
  readonly event_category: string;
  readonly status_code: string | null;
}

export interface LeadMarkerEmbed {
  readonly kind: string;
  readonly actor_id: string;
  readonly actor_name: string;
  readonly marked_at: string;
}

export interface LatestTimelineCommentEmbed {
  readonly comment: string;
  readonly created_at: string;
  readonly event_type: string;
  readonly event_category: string | null;
  readonly status_code: string | null;
  readonly new_value: unknown;
}

export interface LeadDetailRelations {
  contactAttempts: readonly ContactAttemptRow[];
  showroomVisits: readonly ShowroomVisitRow[];
  contracts: readonly ContractRow[];
  events: readonly LeadEventRow[];
}

export interface ContactAttemptRow {
  id: string;
  lead_id: string;
  manager_id: string;
  result: string;
  comment: string;
  created_at: string;
  profiles?: { display_name: string | null } | null;
}

export interface ShowroomVisitRow {
  id: string;
  lead_id: string;
  scheduled_at: string;
  ends_at?: string;
  responsible_manager_id?: string | null;
  updated_by?: string | null;
  version?: number;
  status: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractRow {
  id: string;
  lead_id: string;
  planned_at: string | null;
  signed_at: string | null;
  status: string;
  comment: string | null;
  contract_number?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  created_at: string;
}

export interface LeadEventRow {
  id: string;
  lead_id: string;
  actor_id: string | null;
  event_type: string;
  event_category?: string | null;
  status_code?: string | null;
  comment?: string | null;
  comment_translation_en?: string | null;
  comment_translation_source_lang?: string | null;
  comment_translated_at?: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
  profiles?: { display_name: string | null } | null;
}

function joinOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function officeCodeFromRow(row: LeadListRow): OfficeId {
  const office = joinOne(row.offices);
  const code = office?.code;
  return code === 'warsaw' ? 'warsaw' : 'kyiv';
}

function mapSource(
  channel: string | null | undefined,
  sourceSystem: string | null | undefined,
): LeadSource {
  if (channel === 'facebook') return 'facebook';
  if (channel === 'office') return 'office';
  if (channel === 'other') return 'other';
  if (channel === 'website') return 'website';
  if (channel === 'manual') return 'office';
  if (sourceSystem === 'meta_lead_ads') return 'facebook';
  if (sourceSystem === 'site_form') return 'website';
  if (sourceSystem === 'manual') return 'office';
  return 'website';
}

export function mapCreateLeadSource(source: LeadSource): {
  readonly source_system: string;
  readonly source_channel: string;
} {
  return {
    source_system: 'manual',
    source_channel: source,
  };
}

function mapCloseReason(value: string | null | undefined): CloseReason {
  return value?.trim() || 'not_target';
}

function mapEventType(eventType: string): LeadEventType {
  const map: Record<string, LeadEventType> = {
    created: 'created',
    taken: 'taken',
    contact_attempt: 'first_call',
    first_call: 'first_call',
    showroom_visit_scheduled: 'visit_scheduled',
    visit_scheduled: 'visit_scheduled',
    appointment_scheduled: 'visit_scheduled',
    visit_rescheduled: 'visit_rescheduled',
    appointment_rescheduled: 'visit_rescheduled',
    showroom_visit_completed: 'visit_completed',
    visit_completed: 'visit_completed',
    appointment_status_changed: 'visit_completed',
    appointment_updated: 'lead_updated',
    comment: 'comment',
    thinking: 'thinking',
    activated: 'activated',
    reopened: 'reopened',
    closed: 'closed',
    bad_lead: 'closed',
    successful: 'successful',
    contract_signed: 'successful',
    call_status_changed: 'call_status_changed',
    client_status_changed: 'client_status_changed',
    comment_added: 'comment_added',
    lead_reopened: 'lead_reopened',
    attachment: 'attachment',
    lead_updated: 'lead_updated',
    lead_edited: 'lead_updated',
    lead_assigned: 'comment',
  };
  return map[eventType] ?? 'comment';
}

function buildFirstCall(attempts: readonly ContactAttemptRow[]): FirstCall | null {
  const first = attempts[0];
  if (!first) return null;
  return {
    date: first.created_at,
    result: first.result,
    comment: first.comment,
  };
}

function buildVisit(visits: readonly ShowroomVisitRow[]): ShowroomVisit | null {
  const latest = visits.find((visit) => visit.status === 'scheduled') ?? visits[0];
  if (!latest) return null;
  const statusMap: Record<string, ShowroomVisit['status']> = {
    scheduled: 'scheduled',
    rescheduled: 'rescheduled',
    visited: 'completed',
    completed: 'completed',
    no_show: 'rescheduled',
    canceled: 'rescheduled',
  };
  return {
    id: latest.id,
    status: statusMap[latest.status] ?? 'scheduled',
    scheduledAt: latest.scheduled_at,
    endsAt: latest.ends_at,
    responsibleManagerId: latest.responsible_manager_id,
    version: latest.version,
    completedAt: latest.status === 'visited' ? latest.updated_at : undefined,
    comment: latest.comment ?? undefined,
  };
}

function mapContractEmbed(embed: ContractEmbed | null | undefined): LeadContract | null {
  if (!embed) return null;
  if (typeof embed.contract_number !== 'string') return null;
  const amount =
    typeof embed.amount === 'number'
      ? embed.amount
      : typeof embed.amount === 'string'
        ? Number(embed.amount)
        : NaN;
  if (!Number.isFinite(amount)) return null;
  return {
    contractNumber: embed.contract_number,
    amount,
    currency: isContractCurrency(embed.currency) ? embed.currency : 'EUR',
    comment: '',
    signedAt: typeof embed.signed_at === 'string' ? embed.signed_at : new Date().toISOString(),
  };
}

function mapCallStatusActor(value: LeadListRow['call_status_actor']): CallStatusActor | null {
  if (!value) return null;
  const actorId = typeof value.actor_id === 'string' ? value.actor_id.trim() : '';
  const actorName = typeof value.actor_name === 'string' ? value.actor_name.trim() : '';
  return actorId && actorName ? { actorId, actorName } : null;
}

function buildContract(
  contracts: readonly ContractRow[],
  events: readonly LeadEventRow[],
): LeadContract | null {
  const signed = contracts.find((contract) => contract.status === 'signed') ?? contracts[0];
  const successEvent = events.find(
    (event) =>
      event.event_type === 'successful' ||
      event.event_type === 'contract_signed' ||
      (event.event_type === 'client_status_changed' && event.status_code === 'contract_signed'),
  );
  const structured = parseContractFromNewValue(successEvent?.new_value);
  if (structured) {
    return {
      contractNumber: structured.contractNumber,
      amount: structured.amount,
      currency: structured.currency,
      comment: successEvent?.comment?.trim() || structured.comment,
      signedAt:
        structured.signedAt ??
        signed?.signed_at ??
        successEvent?.created_at ??
        new Date().toISOString(),
    };
  }

  if (!signed) return null;

  const signedAmount =
    typeof signed.amount === 'number'
      ? signed.amount
      : typeof signed.amount === 'string'
        ? Number(signed.amount)
        : NaN;
  if (
    signed.contract_number?.trim() &&
    Number.isFinite(signedAmount) &&
    isContractCurrency(signed.currency)
  ) {
    return {
      contractNumber: signed.contract_number,
      amount: signedAmount,
      currency: signed.currency,
      comment: signed.comment?.trim() ?? '',
      signedAt: signed.signed_at ?? signed.created_at,
    };
  }

  const parsed = parseContractComment(signed.comment);
  return {
    contractNumber: parsed.contractNumber,
    amount: parsed.amount,
    currency: parsed.currency,
    comment: parsed.comment,
    signedAt: signed.signed_at ?? signed.created_at,
  };
}

function parseContractFromNewValue(value: unknown): {
  contractNumber: string;
  amount: number;
  currency: ContractCurrency;
  comment: string;
  signedAt?: string;
} | null {
  if (!isRecord(value)) return null;
  const contractNumber = value['contract_number'];
  const amount = value['amount'];
  if (typeof contractNumber !== 'string' || typeof amount !== 'number') return null;
  const signedAt = value['signed_at'];
  return {
    contractNumber,
    amount,
    currency: isContractCurrency(value['currency']) ? value['currency'] : 'EUR',
    comment: '',
    signedAt: typeof signedAt === 'string' ? signedAt : undefined,
  };
}

function parseContractComment(comment: string | null): {
  contractNumber: string;
  amount: number;
  currency: ContractCurrency;
  comment: string;
} {
  if (!comment) {
    return { contractNumber: '—', amount: 0, currency: 'EUR', comment: '' };
  }
  const numberMatch = comment.match(/№\s*([^\s,]+)/i);
  const amountMatch = comment.match(/(\d[\d\s.,]*)\s*(EUR|PLN|USD|UAH)?/i);
  const currencyRaw = amountMatch?.[2]?.toUpperCase();
  return {
    contractNumber: numberMatch?.[1] ?? '—',
    amount: amountMatch ? Number(amountMatch[1].replace(/\s/g, '').replace(',', '.')) : 0,
    currency: isContractCurrency(currencyRaw) ? currencyRaw : 'EUR',
    comment,
  };
}

function buildClose(
  workflowStatus: LeadWorkflowStatus,
  clientStatus: ClientStatus,
  lossReason: string | null,
  events: readonly LeadEventRow[],
  lastComment: string | null,
  closedAtFallback: string,
): LeadClose | null {
  if (workflowStatus !== 'closed' && clientStatus !== 'closed_lost') return null;
  const closeEvent = events.find(
    (event) =>
      event.event_type === 'closed' ||
      event.event_type === 'bad_lead' ||
      (event.event_type === 'client_status_changed' && event.status_code === 'closed_lost'),
  );
  const eventReason = isRecord(closeEvent?.new_value) ? closeEvent.new_value['reason'] : null;
  const reason = mapCloseReason(typeof eventReason === 'string' ? eventReason : lossReason);
  const eventComment = resolveCloseUserComment(closeEvent?.comment, reason);
  const leadComment = resolveCloseUserComment(lastComment, reason);
  return {
    reason,
    comment: eventComment || leadComment,
    closedAt: closeEvent?.created_at ?? closedAtFallback,
    actorId: closeEvent?.actor_id ?? '',
  };
}

function mapEvents(events: readonly LeadEventRow[]): readonly LeadEvent[] {
  return events.map((event) => ({
    id: event.id,
    type: mapEventType(event.event_type),
    rawType: event.event_type,
    comment: event.comment ?? null,
    translationEn: event.comment_translation_en?.trim() || null,
    translationSourceLanguage:
      event.comment_translation_source_lang === 'UK' ||
      event.comment_translation_source_lang === 'PL'
        ? event.comment_translation_source_lang
        : null,
    translatedAt: event.comment_translated_at ?? null,
    newValue: event.new_value,
    actorId: event.actor_id ?? '',
    actorName: event.profiles?.display_name?.trim() || '',
    occurredAt: event.created_at,
    category: mapEventCategory(event.event_category),
    statusCode: event.status_code ?? null,
    editAudit: eventEditAudit(event.new_value),
  }));
}

function mapEventCategory(value: string | null | undefined): LeadEventCategory | null {
  if (
    value === 'call_status' ||
    value === 'client_status' ||
    value === 'comment' ||
    value === 'system'
  ) {
    return value;
  }
  return null;
}

function eventEditAudit(value: unknown): LeadEventEditAudit | null {
  if (!isRecord(value)) return null;
  const audit = value['edit_audit'];
  if (!isRecord(audit)) return null;
  const fields = audit['fields'];
  const editedAt = audit['edited_at'];
  const editedById = audit['edited_by'];
  const editedByName = audit['edited_by_name'];
  if (!Array.isArray(fields) || typeof editedAt !== 'string') return null;
  return {
    fields: fields.filter((field): field is string => typeof field === 'string'),
    editedAt,
    editedById: typeof editedById === 'string' ? editedById : '',
    editedByName: typeof editedByName === 'string' ? editedByName : 'Невідомий',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mapLeadListRow(row: LeadListRow): MockLead {
  const attempt = row.first_contact_attempt;
  const contactAttempts: ContactAttemptRow[] = attempt
    ? [
        {
          id: '',
          lead_id: row.id,
          manager_id: attempt.manager_id,
          result: attempt.result,
          comment: attempt.comment,
          created_at: attempt.created_at,
        },
      ]
    : [];

  return mapLeadDetail(row, {
    contactAttempts,
    showroomVisits: [],
    contracts: [],
    events: [],
  });
}

export function mapLeadDetail(row: LeadListRow, relations: LeadDetailRelations): MockLead {
  const workflowStatus = toSimplifiedWorkflowStatus(row.workflow_status);
  const clientStatus = mapClientStatus(row.client_status);
  const officeCode = officeCodeFromRow(row);
  const firstCall = buildFirstCall(relations.contactAttempts);
  const visit = buildVisit(relations.showroomVisits);
  const contract =
    buildContract(relations.contracts, relations.events) ?? mapContractEmbed(row.contract);
  const close = buildClose(
    workflowStatus,
    clientStatus,
    row.loss_reason,
    relations.events,
    row.last_comment,
    row.workflow_status_changed_at ?? row.last_comment_at ?? row.updated_at,
  );

  const firstManagerId =
    relations.contactAttempts.at(-1)?.manager_id ??
    relations.events.find((event) => event.event_type === 'taken')?.actor_id ??
    row.assigned_to;

  const reactivatedAt =
    row.reactivated_at ??
    [...relations.events]
      .filter(
        (event) =>
          event.event_type === 'activated' ||
          event.event_type === 'reopened' ||
          event.event_type === 'lead_reopened',
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.created_at ??
    null;

  const callbackDueContext = mapCallbackDueContext(row.callback_due_context);
  const showroomDueAt =
    row.showroom_due_at !== undefined
      ? row.showroom_due_at
      : callbackDueContext?.category === 'client_status' &&
          callbackDueContext.statusCode === 'showroom_invited'
        ? row.callback_due_at
        : null;

  return {
    id: row.id,
    version: row.version ?? 1,
    archivedAt: row.archived_at ?? null,
    name: row.name ?? 'Без імені',
    phone: formatPhoneDisplay(row.phone, officeCode),
    email: row.email,
    leadStatus: mapLeadStatus(row.lead_status),
    workflowStatus,
    callStatus: mapCallStatus(row.call_status),
    callStatusChangedAt: row.call_status_changed_at,
    callStatusActor: mapCallStatusActor(row.call_status_actor),
    clientStatus,
    clientStatusChangedAt: row.client_status_changed_at ?? row.updated_at,
    officeCode,
    source: mapSource(row.source_channel, row.source_system),
    sourceCreatedAt: row.source_created_at ?? row.created_at,
    reactivatedAt,
    initialMessage: row.order_comment ?? row.source_note ?? '',
    cityRegion: row.city_region ?? '',
    productInterest: row.product_interest ?? '',
    estimatedBudget: row.estimated_budget,
    assignedToId: row.assigned_to,
    firstManagerId,
    firstCall,
    visit,
    close,
    contract,
    callbackDueAt: row.callback_due_at,
    commentReminderDueAt: row.comment_reminder_due_at ?? null,
    callbackDueContext,
    showroomDueAt,
    lastComment: row.last_comment,
    latestTimelineComment: mapLatestTimelineComment(row.latest_timeline_comment),
    lastActivityAt: row.updated_at,
    attachments: [],
    events: mapEvents(relations.events),
    markers: mapLeadMarkers(row.markers),
  };
}

function mapCallbackDueContext(
  value: CallbackDueContextEmbed | null | undefined,
): CallbackDueContext | null {
  if (
    value?.event_category !== 'call_status' &&
    value?.event_category !== 'client_status' &&
    value?.event_category !== 'comment'
  ) {
    return null;
  }
  return { category: value.event_category, statusCode: value.status_code };
}

export function mapLeadMarker(value: LeadMarkerEmbed): LeadMarker | null {
  if (!isLeadMarkerKind(value.kind)) return null;
  return {
    kind: value.kind,
    actorId: value.actor_id,
    actorName: value.actor_name.trim() || 'Невідомий',
    markedAt: value.marked_at,
  };
}

function mapLeadMarkers(
  values: readonly LeadMarkerEmbed[] | null | undefined,
): readonly LeadMarker[] {
  return (values ?? []).flatMap((value) => {
    const marker = mapLeadMarker(value);
    return marker ? [marker] : [];
  });
}

function isLeadMarkerKind(value: string): value is LeadMarkerKind {
  return value === 'reviewed' || value === 'manager_aware';
}

function mapCallStatus(status: string | null | undefined): CallStatus | null {
  if (status === 'reached' || status === 'no_answer' || status === 'callback_requested')
    return status;
  return null;
}

function mapClientStatus(status: string | null | undefined): ClientStatus {
  switch (status) {
    case 'showroom_invited':
    case 'calculation_in_progress':
    case 'thinking':
    case 'closed_lost':
    case 'contract_signed':
      return status;
    default:
      return 'new_lead';
  }
}

function mapLatestTimelineComment(
  value: LatestTimelineCommentEmbed | null | undefined,
): LatestTimelineComment | null {
  if (!value?.comment?.trim()) return null;
  return {
    comment: value.comment,
    occurredAt: value.created_at,
    eventType: value.event_type,
    category: mapEventCategory(value.event_category),
    statusCode: value.status_code,
    newValue: value.new_value,
  };
}

function mapLeadStatus(status: string): MockLead['leadStatus'] {
  if (status === 'converted') return 'converted';
  if (status === 'failed') return 'failed';
  if (status === 'in_progress') return 'in_progress';
  return 'new';
}

export function officeNameFromCode(code: string, offices: readonly Office[]): string {
  const office = offices.find((item) => item.code === code);
  return office?.name_uk ?? code;
}

export function displayNameFromProfile(
  profile: { display_name: string | null } | null | undefined,
): string {
  return profile?.display_name?.trim() || 'Невідомий';
}
