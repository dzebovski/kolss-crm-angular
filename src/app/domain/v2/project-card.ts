import type {
  V2ProjectCancellation,
  V2ProjectContract,
  V2ProjectContractKind,
  V2ProjectPayment,
  V2ProjectStatus,
} from './project.types';

/** Pure helpers of the project card (P4). Screen code formats dates, money and names. */

/** A `YYYY-MM-DD` office-local day as a local-time `Date` (no UTC shift for `new Date('YYYY-MM-DD')`). */
export function v2ProjectDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, (month || 1) - 1, date || 1);
}

/** Restore returns to the status held before Cancel; the API falls back to `estimate`. */
export function v2ProjectRestoreStatus(
  cancellation: Pick<V2ProjectCancellation, 'previousStatus'>,
): V2ProjectStatus {
  return cancellation.previousStatus ?? 'estimate';
}

/** The payments of one contract, oldest first (the API sends both contracts' payments). */
export function v2ContractPayments(
  payments: readonly V2ProjectPayment[],
  kind: V2ProjectContractKind,
): readonly V2ProjectPayment[] {
  return payments.filter((payment) => payment.contractKind === kind);
}

/**
 * The paid bar of a contract: the share covered by its own payments and, for the main contract,
 * the share covered by the credited intro payment (drawn as a separate segment), both 0–100.
 */
export function v2ContractBar(contract: Pick<V2ProjectContract, 'total' | 'paid' | 'credited'>): {
  readonly credited: number;
  readonly paid: number;
} {
  const total = contract.total.amount;
  if (total <= 0) return { credited: 0, paid: 0 };
  const credited = Math.min(100, (contract.credited.amount / total) * 100);
  const paid = Math.min(100 - credited, (contract.paid.amount / total) * 100);
  return { credited: round(credited), paid: round(paid) };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
