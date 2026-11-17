import type { HrDayPart, HrEntryType } from '@core/api/generated/kolss-api.types';

/** The entry an Edit absence popup changes (from an `HrEntry` or a calendar cell). */
export interface HrAbsenceEdit {
  readonly id: string;
  readonly kind: 'absence' | 'makeup';
  readonly employeeId: string;
  readonly type: HrEntryType;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly part: HrDayPart;
  readonly comment: string | null;
}

export interface HrAbsenceDialogData {
  /** Whose entry; the viewer's own when omitted (only HR admins pick someone else). */
  readonly employeeId?: string;
  /** Edit mode. */
  readonly entry?: HrAbsenceEdit;
  /** Prefill of From / To for a new entry. */
  readonly date?: string;
}

export interface HrPlanDialogData {
  /** Whose hours; the viewer's own when omitted. */
  readonly employeeId?: string;
  /** Monday of the week to open; next week by default. */
  readonly weekStart?: string;
}
