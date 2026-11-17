import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { HrAccount } from '@core/api/generated/kolss-api.types';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { hrInitials, hrSearchText } from '@domain/hr/hr-entry';
import {
  hasHrPatternErrors,
  hrPatternDraft,
  hrPatternPreview,
  hrPatternRequest,
  validateHrPattern,
} from '@domain/hr/hr-pattern';
import { HrService } from '@services/hr/hr.service';
import { V2DialogShell } from '../../v2/ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../v2/ui/dialog/v2-form-field';
import { V2ToastService } from '../../v2/ui/toast/v2-toast';
import { HrSession } from '../hr-session';
import { HrText } from '../hr-text';
import { HrPatternFields } from './hr-pattern-fields';

// Add to HR tracking (HR-add-to-tracking.dc.html, super admin, 560): pick a CRM account
// (already tracked ones are disabled with a tag), office, start date, schedule and the vacation
// limit prefilled from the office default. Opens the new employee page after saving.
@Component({
  selector: 'app-hr-add-tracking-dialog',
  imports: [HrPatternFields, TranslatePipe, V2DialogShell, V2FormField],
  templateUrl: './hr-add-tracking-dialog.html',
  styleUrl: './hr-add-tracking-dialog.scss',
})
export class HrAddTrackingDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly hr = inject(HrService);
  private readonly router = inject(Router);
  private readonly toast = inject(V2ToastService);
  private readonly session = inject(HrSession);
  protected readonly text = inject(HrText);

  private readonly today = this.session.value()?.today ?? '';
  protected readonly year = Number((this.today || '2026').slice(0, 4));

  protected readonly accounts = resource({ loader: () => this.hr.accounts() });
  protected readonly query = signal('');
  protected readonly profileId = signal('');
  protected readonly officeId = signal(this.session.defaultOfficeId());
  /** Today, so new people show up in the current week at once (owner decision, 2026-11-17). */
  protected readonly startedOn = signal(this.today);
  protected readonly position = signal('');
  protected readonly draft = signal(hrPatternDraft(null));
  protected readonly attempted = signal(false);
  protected readonly saving = signal(false);

  protected readonly office = resource({
    params: () => (this.officeId() ? { id: this.officeId() } : undefined),
    loader: ({ params }) => this.hr.settings(params.id),
  });
  protected readonly officeValue = computed(() =>
    this.office.hasValue() ? this.office.value() : undefined,
  );
  protected readonly vacationText = linkedSignal(() =>
    String(this.officeValue()?.defaultVacationDays ?? ''),
  );

  protected readonly officeOptions = computed(() =>
    this.session.offices().map((o) => ({ value: o.id, label: this.text.officeName(o) })),
  );

  protected readonly matches = computed(() => {
    const list = this.accounts.hasValue() ? this.accounts.value() : [];
    const q = hrSearchText(this.query().trim());
    // Every account matches when the search is empty; the list scrolls.
    return list
      .filter(
        (a) =>
          !q ||
          hrSearchText(a.displayName ?? '').includes(q) ||
          hrSearchText(a.email ?? '').includes(q),
      )
      .map((a) => ({
        account: a,
        initials: hrInitials(a.displayName ?? a.email),
        name: a.displayName || a.email || '',
        sub: [a.email, a.officeCodes.map((code) => this.officeLabel(code)).join(', ')]
          .filter(Boolean)
          .join(' · '),
      }));
  });

  private readonly vacationDays = computed(() => {
    const text = this.vacationText().trim();
    if (!text) return null;
    const n = Number(text.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 && n <= 366 && (n * 2) % 1 === 0 ? n : undefined;
  });
  private readonly patternErrors = computed(() => {
    const office = this.officeValue();
    return office ? validateHrPattern(this.draft(), office) : {};
  });
  protected readonly errors = computed(() => ({
    account: !this.profileId(),
    start: !this.startedOn(),
    vacation: this.vacationDays() === undefined,
    pattern: hasHrPatternErrors(this.patternErrors()),
  }));
  protected readonly errorCount = computed(
    () =>
      Object.values(this.errors()).filter(Boolean).length -
      (this.errors().pattern ? 1 : 0) +
      Object.keys(this.patternErrors()).length,
  );
  protected readonly invalid = computed(() => Object.values(this.errors()).some(Boolean));
  protected readonly preview = computed(() => this.text.schedule(hrPatternPreview(this.draft())));
  protected readonly dirty = computed(() => !!this.profileId() || !!this.position().trim());

  private officeLabel(code: string): string {
    const office = this.session.offices().find((o) => o.code === code);
    return office ? this.text.officeName(office) : code;
  }

  protected pick(account: HrAccount): void {
    if (account.isTracked) return;
    this.profileId.set(account.profileId);
    this.query.set(account.displayName || account.email || '');
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    this.attempted.set(true);
    if (this.invalid()) return;
    this.saving.set(true);
    try {
      const detail = await this.hr.createEmployee({
        profileId: this.profileId(),
        officeId: this.officeId(),
        position: this.position().trim() || null,
        startedOn: this.startedOn(),
        pattern: hrPatternRequest(this.draft()),
        vacationDays: this.vacationDays() ?? null,
      });
      this.toast.show(this.text.t('hr.toast.saved'));
      this.dialogRef.close(true);
      void this.router.navigate(['/hr/employees', detail.employee.id]);
    } catch (error) {
      this.saving.set(false);
      this.toast.show(this.text.saveError(error, { today: this.today }));
    }
  }
}
