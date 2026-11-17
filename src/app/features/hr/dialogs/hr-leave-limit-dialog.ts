import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { HrService } from '@services/hr/hr.service';
import { V2DialogShell } from '../../v2/ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../v2/ui/dialog/v2-form-field';
import { V2ToastService } from '../../v2/ui/toast/v2-toast';
import { HrText } from '../hr-text';
import type { HrLeaveLimitDialogData } from './hr-dialog.types';

// Vacation limit (HR-leave-limit.dc.html, super admin, 560): year + days, with used so far and
// what the new limit leaves. Going over is allowed.
@Component({
  selector: 'app-hr-leave-limit-dialog',
  imports: [TranslatePipe, V2DialogShell, V2FormField],
  template: `
    <app-v2-dialog
      width="status"
      [title]="'hr.limit.title' | translate: { name: data.name }"
      [subtitle]="'hr.limit.subtitle' | translate"
      [saveLabel]="'hr.limit.save' | translate"
      [saveDisabled]="saving()"
      [invalid]="invalid()"
      [errorCount]="invalid() ? 1 : 0"
      [hasUnsavedInput]="daysText() !== initialDays()"
      (save)="save()"
      (invalidAttempt)="attempted.set(true)"
    >
      <div class="hr-ll">
        <app-v2-form-field [label]="'hr.limit.year' | translate" hint=" ">
          <select (change)="setYear(+$any($event.target).value)">
            @for (y of years; track y.year) {
              <option [value]="y.year" [selected]="y.year === year()">{{ y.year }}</option>
            }
          </select>
        </app-v2-form-field>
        <app-v2-form-field
          [label]="'hr.limit.days' | translate"
          [error]="attempted() && invalid() ? ('hr.error.required' | translate) : ''"
          [hint]="'hr.limit.default' | translate: { n: data.defaultDays }"
        >
          <input
            inputmode="numeric"
            [value]="daysText()"
            [attr.aria-invalid]="attempted() && invalid()"
            (input)="daysText.set($any($event.target).value)"
          />
        </app-v2-form-field>
      </div>
      <p class="hr-ll__sum" aria-live="polite">{{ summary() }}</p>
    </app-v2-dialog>
  `,
  styles: `
    @use '../../../../styles/v2/type';

    .hr-ll {
      display: grid;
      grid-template-columns: 160px minmax(0, 1fr);
      gap: 12px;
    }

    .hr-ll__sum {
      @include type.text('caption');

      margin: 4px 0 0;
      color: var(--v2-muted);
    }
  `,
})
export class HrLeaveLimitDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<HrLeaveLimitDialogData>(DIALOG_DATA);
  private readonly hr = inject(HrService);
  private readonly toast = inject(V2ToastService);
  protected readonly text = inject(HrText);

  protected readonly years = this.data.leave;
  protected readonly year = signal(this.data.year);
  private readonly entry = computed(() => this.years.find((y) => y.year === this.year()));
  protected readonly initialDays = computed(() =>
    String(this.entry()?.days ?? this.data.defaultDays),
  );
  protected readonly daysText = signal(this.initialDays());
  protected readonly attempted = signal(false);
  protected readonly saving = signal(false);

  private readonly days = computed(() => {
    const text = this.daysText().trim();
    const n = Number(text.replace(',', '.'));
    return text && Number.isFinite(n) && n >= 0 && n <= 366 && (n * 2) % 1 === 0 ? n : null;
  });
  protected readonly invalid = computed(() => this.days() === null);

  protected readonly summary = computed(() => {
    const used = this.entry()?.balance.used ?? 0;
    const current = this.entry()?.balance;
    const parts = [this.text.t('hr.limit.used', { n: this.text.number(used) })];
    const days = this.days();
    if (days !== null) {
      const left = days - used;
      parts.push(
        this.text.t(left >= 0 ? 'hr.limit.withLeft' : 'hr.limit.withOver', {
          d: this.text.number(days),
          n: this.text.number(Math.abs(left)),
        }),
      );
    }
    if (current) {
      parts.push(
        current.over > 0
          ? this.text.t('hr.limit.nowOver', { n: this.text.number(current.over) })
          : this.text.t('hr.limit.nowLeft', { n: this.text.number(current.left) }),
      );
    }
    return parts.join(' · ');
  });

  protected setYear(year: number): void {
    this.year.set(year);
    this.daysText.set(this.initialDays());
  }

  protected async save(): Promise<void> {
    const days = this.days();
    if (this.saving()) return;
    this.attempted.set(true);
    if (days === null) return;
    this.saving.set(true);
    try {
      await this.hr.putLeaveLimit(this.data.employeeId, this.year(), days);
      this.toast.show(this.text.t('hr.toast.saved'));
      this.dialogRef.close(true);
    } catch (error) {
      this.saving.set(false);
      this.toast.show(this.text.saveError(error));
    }
  }
}
