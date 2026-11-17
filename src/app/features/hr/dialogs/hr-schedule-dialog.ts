import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import {
  hasHrPatternErrors,
  hrIsClosedMonth,
  hrNextMonday,
  hrPatternDraft,
  hrPatternPreview,
  hrPatternRequest,
  validateHrPattern,
} from '@domain/hr/hr-pattern';
import { HrService } from '@services/hr/hr.service';
import { V2DialogShell } from '../../v2/ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../v2/ui/dialog/v2-form-field';
import { V2ToastService } from '../../v2/ui/toast/v2-toast';
import { HrText } from '../hr-text';
import type { HrScheduleDialogData } from './hr-dialog.types';
import { HrPatternFields } from './hr-pattern-fields';

// Change schedule (HR-schedule-editor.dc.html, super admin, 640): a new pattern from
// "Valid from" (default next Monday); earlier patterns stay in the history. A date in a closed
// month shows the warning and is still allowed (admin fix).
@Component({
  selector: 'app-hr-schedule-dialog',
  imports: [HrPatternFields, TranslatePipe, V2DialogShell, V2FormField],
  template: `
    <app-v2-dialog
      [title]="'hr.pattern.title' | translate: { name: data.name }"
      [subtitle]="'hr.pattern.subtitle' | translate"
      [saveLabel]="'hr.pattern.save' | translate"
      [saveDisabled]="saving()"
      [invalid]="invalid()"
      [errorCount]="errorCount()"
      [hasUnsavedInput]="true"
      (save)="save()"
      (invalidAttempt)="attempted.set(true)"
    >
      <div class="hr-sd">
        <app-hr-pattern-fields
          [(draft)]="draft"
          [office]="data.office"
          [showErrors]="attempted()"
        />
        <div class="hr-sd__grid">
          <app-v2-form-field
            [label]="'hr.pattern.validFrom' | translate"
            [error]="validFrom() ? '' : attempted() ? ('hr.error.required' | translate) : ''"
            [hint]="(closed() ? 'hr.pattern.closedAdmin' : 'hr.pattern.defaultNext') | translate"
          >
            <input
              type="date"
              required
              [value]="validFrom()"
              (input)="validFrom.set($any($event.target).value)"
            />
          </app-v2-form-field>
          <app-v2-form-field [label]="'hr.pattern.note' | translate" hint=" ">
            <input maxlength="500" [value]="note()" (input)="note.set($any($event.target).value)" />
          </app-v2-form-field>
        </div>
        @if (closed()) {
          <p class="hr-sd__warn" role="status">
            {{
              'hr.pattern.closedWarn'
                | translate: { month: text.monthName(validFrom().slice(0, 7)) }
            }}
          </p>
        }
        @if (validFrom()) {
          <p class="hr-sd__preview">
            <span class="hr-sd__preview-label">{{ 'hr.pattern.preview' | translate }}</span>
            {{ 'hr.pattern.previewFrom' | translate: { date: text.date(validFrom()) } }}
            <strong>{{ preview() }}</strong>
          </p>
        }
      </div>
    </app-v2-dialog>
  `,
  styleUrl: './hr-schedule-dialog.scss',
})
export class HrScheduleDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<HrScheduleDialogData>(DIALOG_DATA);
  private readonly hr = inject(HrService);
  private readonly toast = inject(V2ToastService);
  protected readonly text = inject(HrText);

  protected readonly draft = signal(hrPatternDraft(this.data.pattern));
  protected readonly validFrom = signal(hrNextMonday(this.data.today));
  protected readonly note = signal('');
  protected readonly attempted = signal(false);
  protected readonly saving = signal(false);

  protected readonly closed = computed(
    () => !!this.validFrom() && hrIsClosedMonth(this.validFrom(), this.data.today),
  );
  protected readonly preview = computed(() => this.text.schedule(hrPatternPreview(this.draft())));
  private readonly errors = computed(() => validateHrPattern(this.draft(), this.data.office));
  protected readonly errorCount = computed(
    () => Object.keys(this.errors()).length + (this.validFrom() ? 0 : 1),
  );
  protected readonly invalid = computed(
    () => hasHrPatternErrors(this.errors()) || !this.validFrom(),
  );

  protected async save(): Promise<void> {
    if (this.saving()) return;
    this.attempted.set(true);
    if (this.invalid()) return;
    this.saving.set(true);
    try {
      await this.hr.createPattern(
        this.data.employeeId,
        hrPatternRequest(this.draft(), this.validFrom(), this.note()),
      );
      this.toast.show(this.text.t('hr.toast.saved'));
      this.dialogRef.close(true);
    } catch (error) {
      this.saving.set(false);
      this.toast.show(this.text.saveError(error, { today: this.data.today }));
    }
  }
}
