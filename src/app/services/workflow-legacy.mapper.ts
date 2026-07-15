import type { LeadWorkflowStatus } from './crm-mock.types';

/** Maps legacy production workflow codes to the simplified CRM model. */
const LEGACY_TO_SIMPLIFIED: Record<string, LeadWorkflowStatus> = {
  new: 'new',
  in_work: 'taken',
  callback_required: 'callback_required',
  contacted: 'first_call_done',
  showroom_scheduled: 'visit_scheduled',
  showroom_no_show: 'visit_rescheduled',
  showroom_visited: 'visit_completed',
  contract_planned: 'visit_completed',
  contract_signed: 'successful',
  prepayment_received: 'successful',
  in_production: 'successful',
  postpayment_received: 'successful',
  installed: 'successful',
  warranty: 'successful',
  bad_lead: 'closed',
  taken: 'taken',
  first_call_done: 'first_call_done',
  visit_scheduled: 'visit_scheduled',
  visit_rescheduled: 'visit_rescheduled',
  visit_completed: 'visit_completed',
  thinking: 'thinking',
  closed: 'closed',
  successful: 'successful',
};

export function toSimplifiedWorkflowStatus(status: string): LeadWorkflowStatus {
  return LEGACY_TO_SIMPLIFIED[status] ?? 'new';
}

export function isSimplifiedWorkflowStatus(status: string): status is LeadWorkflowStatus {
  return status in LEGACY_TO_SIMPLIFIED && LEGACY_TO_SIMPLIFIED[status] === status;
}
