import type { ConnectedPosition } from '@angular/cdk/overlay';
import type { HrEmployee } from '@core/api/generated/kolss-api.types';

/** A click on a person's day in the month or week grid; `anchor` positions the popover. */
export interface HrDayPick {
  readonly employee: HrEmployee;
  readonly date: string;
  readonly anchor: Element;
}

/** Day popover placement: below the cell, else above, else right-aligned below. */
export const HR_POPOVER_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
];
