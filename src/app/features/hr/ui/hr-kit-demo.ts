import type { HrCellView } from '@domain/hr/hr-calendar';
import { HR_ENTRY_TYPES } from '@domain/hr/hr-entry';

/** Sample data of the HR kit on `/v2/design` (HR-components.dc.html). */
const BASE: HrCellView = {
  date: '2026-11-16',
  kind: 'hours',
  holiday: false,
  absence: null,
  half: null,
  start: null,
  end: null,
  minutes: 0,
  makeup: false,
  flexible: false,
  today: false,
  past: false,
  closedMonth: false,
};

const ABSENCE = { dateFrom: '2026-11-16', dateTo: '2026-11-16' };

export const HR_KIT_CELLS: readonly {
  readonly label: string;
  readonly view: HrCellView;
  readonly locked?: boolean;
}[] = [
  {
    label: 'Flexible',
    view: { ...BASE, flexible: true, start: '10:00', end: '14:00', minutes: 240 },
  },
  { label: 'Fixed', view: { ...BASE, start: '10:00', end: '18:00', minutes: 480 } },
  { label: 'Off', view: { ...BASE, kind: 'off' } },
  { label: 'Holiday', view: { ...BASE, kind: 'closed', holiday: true } },
  {
    label: 'Absence',
    view: { ...BASE, kind: 'absence', absence: { ...ABSENCE, type: 'vacation', part: 'full_day' } },
  },
  {
    label: 'Half day',
    view: {
      ...BASE,
      kind: 'absence',
      half: 'first_half',
      minutes: 240,
      absence: { ...ABSENCE, type: 'sick', part: 'first_half' },
    },
  },
  {
    label: 'Make-up',
    view: { ...BASE, flexible: true, start: '10:00', end: '14:00', minutes: 240, makeup: true },
  },
  { label: 'Today', view: { ...BASE, start: '10:00', end: '18:00', minutes: 480, today: true } },
  { label: 'Past', view: { ...BASE, start: '10:00', end: '18:00', minutes: 480, past: true } },
  {
    label: 'Closed month',
    view: { ...BASE, start: '10:00', end: '18:00', minutes: 480, past: true },
    locked: true,
  },
];

export const HR_KIT_TYPES = HR_ENTRY_TYPES;
