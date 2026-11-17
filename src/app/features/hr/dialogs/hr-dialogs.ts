import { inject, Service } from '@angular/core';

import { V2DialogService } from '../../v2/ui/dialog/v2-dialog.service';
import { HrAbsenceDialog } from './hr-absence-dialog';
import { HrAddTrackingDialog } from './hr-add-tracking-dialog';
import type {
  HrAbsenceDialogData,
  HrAddTrackingDialogData,
  HrHolidayDialogData,
  HrLeaveLimitDialogData,
  HrPlanDialogData,
  HrScheduleDialogData,
} from './hr-dialog.types';
import { HrHolidayDialog } from './hr-holiday-dialog';
import { HrLeaveLimitDialog } from './hr-leave-limit-dialog';
import { HrPlanHoursDialog } from './hr-plan-hours-dialog';
import { HrScheduleDialog } from './hr-schedule-dialog';

/** Opens the HR popups. Each popup saves itself, shows its toast and closes with `true`. */
@Service()
export class HrDialogs {
  private readonly dialogs = inject(V2DialogService);

  absence(data: HrAbsenceDialogData = {}) {
    return this.dialogs.open<boolean, HrAbsenceDialogData>(HrAbsenceDialog, data);
  }

  planHours(data: HrPlanDialogData = {}) {
    return this.dialogs.open<boolean, HrPlanDialogData>(HrPlanHoursDialog, data);
  }

  addToTracking(data: HrAddTrackingDialogData = {}) {
    return this.dialogs.open<boolean, HrAddTrackingDialogData>(HrAddTrackingDialog, data);
  }

  schedule(data: HrScheduleDialogData) {
    return this.dialogs.open<boolean, HrScheduleDialogData>(HrScheduleDialog, data);
  }

  leaveLimit(data: HrLeaveLimitDialogData) {
    return this.dialogs.open<boolean, HrLeaveLimitDialogData>(HrLeaveLimitDialog, data);
  }

  holiday(data: HrHolidayDialogData) {
    return this.dialogs.open<boolean, HrHolidayDialogData>(HrHolidayDialog, data);
  }
}
