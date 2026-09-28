import type {
  LeadEventCorrectionRequest,
  LeadEventCorrectionType,
} from '@core/api/generated/kolss-api.types';
import { callbackDueAtFromNewValue } from '@domain/lead.rules';
import type { LeadEvent } from '@domain/lead.types';

export const V2_CORRECTION_TYPES: readonly LeadEventCorrectionType[] = [
  'success',
  'later',
  'noanswer',
  'thinking',
  'comment',
];

export function v2EventCorrectionType(event: LeadEvent): LeadEventCorrectionType | null {
  if (event.category === 'call_status') {
    if (event.statusCode === 'reached') return 'success';
    if (event.statusCode === 'callback_requested') return 'later';
    if (event.statusCode === 'no_answer') return 'noanswer';
  }
  if (event.category === 'client_status' && event.statusCode === 'thinking') return 'thinking';
  if (event.category === 'comment' || event.rawType === 'comment_added') return 'comment';
  return null;
}

export function v2CorrectionNeedsDate(type: LeadEventCorrectionType): boolean {
  return type === 'later' || type === 'noanswer' || type === 'thinking';
}

export function v2EventCorrectionDueAt(event: LeadEvent): string {
  return callbackDueAtFromNewValue(event.newValue) ?? '';
}

export interface V2TimelineCorrectionValues {
  readonly type: LeadEventCorrectionType;
  readonly comment: string;
  readonly dueAt: string;
  readonly reason: string;
}

export function v2TimelineCorrectionRequest(
  original: Pick<V2TimelineCorrectionValues, 'type' | 'comment'>,
  value: V2TimelineCorrectionValues,
): LeadEventCorrectionRequest | null {
  const typeChanged = value.type !== original.type;
  const comment = value.comment.trim();
  const commentChanged = comment !== original.comment.trim();
  if (!typeChanged && !commentChanged) return null;
  return {
    ...(typeChanged ? { type: value.type } : {}),
    ...(typeChanged && v2CorrectionNeedsDate(value.type) ? { dueAt: value.dueAt } : {}),
    ...(commentChanged ? { comment } : {}),
    reason: value.reason.trim(),
  };
}
