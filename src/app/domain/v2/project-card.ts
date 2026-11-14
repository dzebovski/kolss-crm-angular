import type { V2ProjectCancellation, V2ProjectStatus } from './project.types';

/** Pure helpers of the project card. Screen code formats dates, money and names. */

/** A `YYYY-MM-DD` office-local day as a local-time `Date` (no UTC shift for `new Date('YYYY-MM-DD')`). */
export function v2ProjectDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, (month || 1) - 1, date || 1);
}

/**
 * The stage Restore returns to (mirrors the API): a completed project goes back to Installation,
 * a closed one to the stage held before Close project, else Preliminary estimate.
 */
export function v2ProjectRestoreStatus(project: {
  readonly status: V2ProjectStatus;
  readonly cancellation: Pick<V2ProjectCancellation, 'previousStatus'> | null;
}): V2ProjectStatus {
  if (project.status === 'completed') return 'installation';
  const previous = project.cancellation?.previousStatus;
  return previous && previous !== 'completed' && previous !== 'cancelled'
    ? previous
    : 'preliminary_estimate';
}
