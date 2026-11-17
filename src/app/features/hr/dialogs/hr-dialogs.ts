import { inject, Service } from '@angular/core';

import { V2DialogService } from '../../v2/ui/dialog/v2-dialog.service';
import { HrAbsenceDialog } from './hr-absence-dialog';
import type { HrAbsenceDialogData, HrPlanDialogData } from './hr-dialog.types';
import { HrPlanHoursDialog } from './hr-plan-hours-dialog';

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

  addToTracking(): void {
    // Wired in HF4 (HR-add-to-tracking.dc.html).
  }
}
