import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';

import type { HrHolidayKind } from '@core/api/generated/kolss-api.types';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { HrService } from '@services/hr/hr.service';
import { V2DialogShell } from '../../v2/ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../v2/ui/dialog/v2-form-field';
import { V2ToastService } from '../../v2/ui/toast/v2-toast';
import { HrSession } from '../hr-session';
import { HrText } from '../hr-text';
import type { HrHolidayDialogData } from './hr-dialog.types';

// Add / edit holiday or closed day (HR-holiday.dc.html, super admin, 560): office, date, kind
// (public holiday | office closed) and name.
@Component({
  selector: 'app-hr-holiday-dialog',
  imports: [TranslatePipe, V2DialogShell, V2FormField],
  template: `
    <app-v2-dialog
      width="status"
      [title]="(data.holiday ? 'hr.holiday.editTitle' : 'hr.holiday.addTitle') | translate"
      [subtitle]="'hr.holiday.subtitle' | translate"
      [saveLabel]="'hr.holiday.save' | translate"
      [saveDisabled]="saving()"
      [invalid]="invalid()"
      [errorCount]="errorCount()"
      [hasUnsavedInput]="!!name().trim()"
      (save)="save()"
      (invalidAttempt)="attempted.set(true)"
    >
      <div class="hr-ho">
        <app-v2-form-field [label]="'hr.office' | translate" hint=" ">
          <select (change)="officeId.set($any($event.target).value)">
            @for (o of offices(); track o.value) {
              <option [value]="o.value" [selected]="o.value === officeId()">{{ o.label }}</option>
            }
          </select>
        </app-v2-form-field>
        <app-v2-form-field
          [label]="'hr.holiday.date' | translate"
          [error]="attempted() && !day() ? ('hr.error.required' | translate) : ''"
          hint=" "
        >
          <input
            type="date"
            required
            [value]="day()"
            (input)="day.set($any($event.target).value)"
          />
        </app-v2-form-field>
        <fieldset class="hr-ho__kind">
          <legend class="hr-ho__legend">{{ 'hr.holiday.kind' | translate }}</legend>
          <div class="hr-ho__seg">
            @for (k of kinds; track k) {
              <button
                type="button"
                [class.hr-ho__seg--on]="kind() === k"
                [attr.aria-pressed]="kind() === k"
                (click)="kind.set(k)"
              >
                {{ kindLabel(k) }}
              </button>
            }
          </div>
        </fieldset>
        <app-v2-form-field
          [label]="'hr.holiday.name' | translate"
          [error]="attempted() && !name().trim() ? ('hr.error.required' | translate) : ''"
          [hint]="'hr.holiday.nameHint' | translate"
        >
          <input
            required
            maxlength="120"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
          />
        </app-v2-form-field>
      </div>
    </app-v2-dialog>
  `,
  styles: `
    @use '../../../../styles/v2/type';

    .hr-ho {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .hr-ho__kind {
      margin: 0 0 12px;
      padding: 0;
      border: 0;
    }

    .hr-ho__legend {
      @include type.text('label');

      margin-bottom: 6px;
      padding: 0;
      color: var(--v2-muted);
    }

    .hr-ho__seg {
      display: inline-flex;
      padding: 3px;
      border-radius: var(--v2-radius-sm);
      background: var(--v2-surface-sunk);

      button {
        @include type.text('label');

        height: 34px;
        padding: 0 14px;
        border: 0;
        border-radius: var(--v2-radius-xs);
        background: transparent;
        color: var(--v2-muted);
        font-weight: 500;
        cursor: pointer;
      }

      button.hr-ho__seg--on {
        background: var(--v2-surface);
        color: var(--v2-ink);
        box-shadow: var(--v2-shadow-control);
      }
    }
  `,
})
export class HrHolidayDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<HrHolidayDialogData>(DIALOG_DATA);
  private readonly hr = inject(HrService);
  private readonly toast = inject(V2ToastService);
  private readonly session = inject(HrSession);
  protected readonly text = inject(HrText);

  protected readonly kinds: readonly HrHolidayKind[] = ['public_holiday', 'office_closed'];
  protected readonly officeId = signal(this.data.holiday?.officeId ?? this.data.officeId);
  protected readonly day = signal(this.data.holiday?.day ?? '');
  protected readonly kind = signal<HrHolidayKind>(this.data.holiday?.kind ?? 'public_holiday');
  protected readonly name = signal(this.data.holiday?.name ?? '');
  protected readonly attempted = signal(false);
  protected readonly saving = signal(false);

  protected readonly offices = computed(() =>
    this.session.offices().map((o) => ({ value: o.id, label: this.text.officeName(o) })),
  );
  protected readonly errorCount = computed(
    () => (this.day() ? 0 : 1) + (this.name().trim() ? 0 : 1),
  );
  protected readonly invalid = computed(() => this.errorCount() > 0);

  protected kindLabel(kind: HrHolidayKind): string {
    return this.text.t(
      kind === 'public_holiday'
        ? 'hr.holiday.kind.public_holiday'
        : 'hr.holiday.kind.office_closed',
    );
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    this.attempted.set(true);
    if (this.invalid()) return;
    this.saving.set(true);
    const body = {
      officeId: this.officeId(),
      day: this.day(),
      kind: this.kind(),
      name: this.name().trim(),
    };
    try {
      if (this.data.holiday) await this.hr.updateHoliday(this.data.holiday.id, body);
      else await this.hr.createHoliday(body);
      this.toast.show(this.text.t('hr.toast.saved'));
      this.dialogRef.close(true);
    } catch (error) {
      this.saving.set(false);
      this.toast.show(this.text.saveError(error));
    }
  }
}
