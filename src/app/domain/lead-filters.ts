import type { CallStatus, ClientStatus } from './lead.types';

/** Filter-only cohorts extend the persisted call statuses used by a lead. */
export type CallStatusFilterKey = CallStatus | 'none' | 'callback_undated';

/** Filter-only cohorts extend the persisted client statuses used by a lead. */
export type ClientStatusFilterKey = ClientStatus | 'in_work' | 'active';

export type SelectableClientStatusFilterKey = Exclude<ClientStatusFilterKey, 'active'>;

export const CALL_STATUS_FILTER_KEYS = [
  'reached',
  'no_answer',
  'callback_requested',
  'none',
  'callback_undated',
] as const satisfies readonly CallStatusFilterKey[];

export const SELECTABLE_CLIENT_STATUS_FILTER_KEYS = [
  'new_lead',
  'in_work',
  'showroom_invited',
  'measurement_scheduled',
  'calculation_in_progress',
  'thinking',
  'postponed',
  'closed_lost',
  'contract_signed',
] as const satisfies readonly SelectableClientStatusFilterKey[];

export const CLIENT_STATUS_FILTER_KEYS = [
  ...SELECTABLE_CLIENT_STATUS_FILTER_KEYS,
  'active',
] as const satisfies readonly ClientStatusFilterKey[];

const ALLOWED_CALL_STATUS_FILTERS = new Set<CallStatusFilterKey>(CALL_STATUS_FILTER_KEYS);
const ALLOWED_CLIENT_STATUS_FILTERS = new Set<ClientStatusFilterKey>(CLIENT_STATUS_FILTER_KEYS);

export function isCallStatusFilterKey(value: unknown): value is CallStatusFilterKey {
  return typeof value === 'string' && ALLOWED_CALL_STATUS_FILTERS.has(value as CallStatusFilterKey);
}

export function isClientStatusFilterKey(value: unknown): value is ClientStatusFilterKey {
  return (
    typeof value === 'string' && ALLOWED_CLIENT_STATUS_FILTERS.has(value as ClientStatusFilterKey)
  );
}
