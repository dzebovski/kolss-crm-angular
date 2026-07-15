import type { Lead, Office } from '../models/database';
import { formatPhoneDisplay } from '../core/phone/phone';
import type {
  CloseReason,
  FirstCall,
  LeadClose,
  LeadContract,
  LeadEvent,
  LeadEventEditAudit,
  LeadEventType,
  LeadSource,
  LeadWorkflowStatus,
  MockLead,
  OfficeId,
  ShowroomVisit,
} from './crm-mock.types';
import { resolveCloseUserComment } from './crm-mock.helpers';
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

export type LeadListRow = Lead & {
  offices?: Office | Office[] | null;
  profiles?: { id: string; display_name: string | null } | { id: string; display_name: string | null }[] | null;
  first_contact_attempt?: FirstContactAttemptEmbed | null;
};

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
  created_at: string;
}

export interface LeadEventRow {
  id: string;
  lead_id: string;
  actor_id: string | null;
  event_type: string;
  comment?: string | null;
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

function mapSource(channel: string | null | undefined, sourceSystem: string | null | undefined): LeadSource {
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
    visit_rescheduled: 'visit_rescheduled',
    showroom_visit_completed: 'visit_completed',
    visit_completed: 'visit_completed',
    comment: 'comment',
    closed: 'closed',
    bad_lead: 'closed',
    successful: 'successful',
    contract_signed: 'successful',
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
  const latest = visits[0];
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
    status: statusMap[latest.status] ?? 'scheduled',
    scheduledAt: latest.scheduled_at,
    completedAt: latest.status === 'visited' ? latest.updated_at : undefined,
    comment: latest.comment ?? undefined,
  };
}

function buildContract(
  contracts: readonly ContractRow[],
  events: readonly LeadEventRow[],
): LeadContract | null {
  const signed = contracts.find((contract) => contract.status === 'signed') ?? contracts[0];
  const successEvent = events.find(
    (event) => event.event_type === 'successful' || event.event_type === 'contract_signed',
  );
  const structured = parseContractFromNewValue(successEvent?.new_value);
  if (structured) {
    return {
      contractNumber: structured.contractNumber,
      amount: structured.amount,
      prepayment: structured.prepayment,
      comment: successEvent?.comment?.trim() || structured.comment,
      signedAt: signed?.signed_at ?? successEvent?.created_at ?? new Date().toISOString(),
    };
  }

  if (!signed) return null;

  const parsed = parseContractComment(signed.comment);
  return {
    contractNumber: parsed.contractNumber,
    amount: parsed.amount,
    prepayment: parsed.prepayment,
    comment: parsed.comment,
    signedAt: signed.signed_at ?? signed.created_at,
  };
}

function parseContractFromNewValue(value: unknown): {
  contractNumber: string;
  amount: number;
  prepayment: number | null;
  comment: string;
} | null {
  if (!isRecord(value)) return null;
  const contractNumber = value['contract_number'];
  const amount = value['amount'];
  if (typeof contractNumber !== 'string' || typeof amount !== 'number') return null;
  const prepayment = value['prepayment'];
  return {
    contractNumber,
    amount,
    prepayment: typeof prepayment === 'number' ? prepayment : null,
    comment: '',
  };
}

function parseContractComment(comment: string | null): {
  contractNumber: string;
  amount: number;
  prepayment: number | null;
  comment: string;
} {
  if (!comment) {
    return { contractNumber: '—', amount: 0, prepayment: null, comment: '' };
  }
  const numberMatch = comment.match(/№\s*([^\s,]+)/i);
  const amountMatch = comment.match(/(\d[\d\s.,]*)\s*(EUR|PLN|USD)?/i);
  return {
    contractNumber: numberMatch?.[1] ?? '—',
    amount: amountMatch ? Number(amountMatch[1].replace(/\s/g, '').replace(',', '.')) : 0,
    prepayment: null,
    comment,
  };
}

function buildClose(
  workflowStatus: LeadWorkflowStatus,
  lossReason: string | null,
  events: readonly LeadEventRow[],
  lastComment: string | null,
  closedAtFallback: string,
): LeadClose | null {
  if (workflowStatus !== 'closed') return null;
  const closeEvent = events.find((event) => event.event_type === 'closed' || event.event_type === 'bad_lead');
  const reason = mapCloseReason(lossReason);
  const eventComment = resolveCloseUserComment(closeEvent?.comment, reason);
  const leadComment = resolveCloseUserComment(lastComment, reason);
  return {
    reason,
    comment: leadComment || eventComment,
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
    newValue: event.new_value,
    actorId: event.actor_id ?? '',
    actorName: event.profiles?.display_name?.trim() || '',
    occurredAt: event.created_at,
    editAudit: eventEditAudit(event.new_value),
  }));
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
  const officeCode = officeCodeFromRow(row);
  const firstCall = buildFirstCall(relations.contactAttempts);
  const visit = buildVisit(relations.showroomVisits);
  const contract = buildContract(relations.contracts, relations.events);
  const close = buildClose(
    workflowStatus,
    row.loss_reason,
    relations.events,
    row.last_comment,
    row.workflow_status_changed_at ?? row.last_comment_at ?? row.updated_at,
  );

  const firstManagerId =
    relations.contactAttempts.at(-1)?.manager_id ??
    relations.events.find((event) => event.event_type === 'taken')?.actor_id ??
    row.assigned_to;

  return {
    id: row.id,
    version: row.version ?? 1,
    archivedAt: row.archived_at ?? null,
    name: row.name ?? 'Без імені',
    phone: formatPhoneDisplay(row.phone, officeCode),
    email: row.email,
    leadStatus: mapLeadStatus(row.lead_status),
    workflowStatus,
    officeCode,
    source: mapSource(row.source_channel, row.source_system),
    sourceCreatedAt: row.source_created_at ?? row.created_at,
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
    lastComment: row.last_comment,
    lastActivityAt: row.updated_at,
    attachments: [],
    events: mapEvents(relations.events),
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
