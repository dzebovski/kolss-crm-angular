import type { MessageKey } from '@core/i18n/messages';
import type { V2LeadDisplayStatus, V2LeadRating } from '@domain/v2/lead-view.types';

/** Anything the v2 kit marks with a coloured dot: a lead status or a rating. */
export type V2Tone = V2LeadDisplayStatus | V2LeadRating;

const RATINGS: readonly V2Tone[] = ['cold', 'medium', 'hot'] satisfies readonly V2LeadRating[];

// Legacy statuses (D1c) have no colour in the design system; they use the neutral `subtle`.
const LEGACY_STATUSES: readonly V2Tone[] = [
  'measurement_scheduled',
  'calculation_in_progress',
  'postponed',
  'contract_signed',
];

/** CSS colour of the dot for a status (`status-*` token) or a rating (`rating-*` token). */
export function v2ToneColor(tone: V2Tone): string {
  if (RATINGS.includes(tone)) return `var(--v2-rating-${tone})`;
  if (LEGACY_STATUSES.includes(tone)) return 'var(--v2-subtle)';
  return `var(--v2-status-${tone})`;
}

export const V2_STATUS_LABEL: Record<V2LeadDisplayStatus, MessageKey> = {
  new: 'v2.status.new',
  later: 'v2.status.later',
  noanswer: 'v2.status.noanswer',
  success: 'v2.status.success',
  thinking: 'v2.status.thinking',
  invited: 'v2.status.invited',
  lost: 'v2.status.lost',
  project: 'v2.status.project',
  measurement_scheduled: 'v2.status.measurement_scheduled',
  calculation_in_progress: 'v2.status.calculation_in_progress',
  postponed: 'v2.status.postponed',
  contract_signed: 'v2.status.contract_signed',
};

export const V2_RATING_LABEL: Record<V2LeadRating, MessageKey> = {
  cold: 'v2.rating.cold',
  medium: 'v2.rating.medium',
  hot: 'v2.rating.hot',
};
