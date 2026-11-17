import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';

import type {
  HrDayPart,
  HrEntryType,
  HrOffice,
  HrPattern,
  HrVacationBalance,
} from '@core/api/generated/kolss-api.types';
import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { monthOf } from '@domain/hr/hr-dates';
import {
  HR_DAY_PARTS,
  HR_ENTRY_TYPES,
  hasHrAbsenceErrors,
  hrAbsenceDays,
  hrName,
  validateHrAbsence,
} from '@domain/hr/hr-entry';
import { HrService } from '@services/hr/hr.service';
import { V2DialogShell } from '../../v2/ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../v2/ui/dialog/v2-form-field';
import { V2Button } from '../../v2/ui/v2-button';
import { V2SegmentedControl, type V2SegmentOption } from '../../v2/ui/v2-segmented-control';
import { V2Select, type V2SelectOption } from '../../v2/ui/v2-select';
import { V2ToastService } from '../../v2/ui/toast/v2-toast';
import { HrSession } from '../hr-session';
import { HrText } from '../hr-text';
import { HrTypeIcon } from '../ui/hr-type-icon';
import type { HrAbsenceDialogData } from './hr-dialog.types';

interface HrTarget {
  readonly pattern: HrPattern | null;
  readonly office: HrOffice;
  readonly vacation: HrVacationBalance | null;
  readonly makeupOwed: number;
}

// Add / Edit absence popup (HR-add-absence / -today / -errors / HR-edit-absence.dc.html, 640).
// Every save is immediate and posts to Slack. Employee select for HR admins only. Part of day
// only for a single day. Over-limit vacation is a warning; Save stays enabled.
@Component({
  selector: 'app-hr-absence-dialog',
  imports: [
    HrTypeIcon,
    TranslatePipe,
    V2Button,
    V2DialogShell,
    V2FormField,
    V2SegmentedControl,
    V2Select,
  ],
  templateUrl: './hr-absence-dialog.html',
  styleUrl: './hr-absence-dialog.scss',
})
export class HrAbsenceDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly data = inject<HrAbsenceDialogData>(DIALOG_DATA) ?? {};
  private readonly hr = inject(HrService);
  private readonly toast = inject(V2ToastService);
  private readonly session = inject(HrSession);
  protected readonly text = inject(HrText);

  protected readonly entry = this.data.entry ?? null;
  protected readonly isEdit = !!this.entry;
  protected readonly admin = this.session.canManageHr();
  private readonly me = this.session.value();
  protected readonly today = this.me?.today ?? '';

  protected readonly employeeId = signal(
    this.data.employeeId ?? this.entry?.employeeId ?? this.me?.employee?.id ?? '',
  );
  protected readonly type = signal<HrEntryType>(this.entry?.type ?? 'vacation');
  protected readonly dateFrom = signal(this.entry?.dateFrom ?? this.data.date ?? this.today);
  protected readonly dateTo = signal(this.entry?.dateTo ?? this.data.date ?? this.today);
  protected readonly comment = signal(this.entry?.comment ?? '');
  protected readonly single = computed(
    () => !!this.dateFrom() && this.dateFrom() === this.dateTo(),
  );
  /** Resets to Full day whenever the range stops being a single day. */
  protected readonly part = linkedSignal<boolean, HrDayPart>({
    source: this.single,
    computation: (single, previous) =>
      single ? (previous?.value ?? this.entry?.part ?? 'full_day') : 'full_day',
  });
  protected readonly attempted = signal(false);
  protected readonly saving = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly serverError = signal('');

  protected readonly types = this.isEdit
    ? HR_ENTRY_TYPES.filter((type) => type !== 'makeup_day')
    : HR_ENTRY_TYPES;

  /** HR admins: every tracked person for the Employee select. */
  private readonly team = resource({
    params: () => (this.admin ? { all: true } : undefined),
    loader: () => this.hr.team({}),
  });

  /** Another person's schedule, office and balances (HR admins); own data comes from `/hr/me`. */
  private readonly detail = resource({
    params: () => {
      const id = this.employeeId();
      return id && (this.admin || id !== this.me?.employee?.id) ? { id } : undefined;
    },
    loader: ({ params }) => this.hr.employee(params.id),
  });

  protected readonly target = computed<HrTarget | null>(() => {
    const own = this.employeeId() === this.me?.employee?.id;
    const year = Number(this.dateFrom().slice(0, 4)) || Number(this.today.slice(0, 4));
    if (this.detail.hasValue()) {
      const d = this.detail.value();
      return {
        pattern: d.employee.pattern,
        office: d.office,
        vacation: d.leave.find((l) => l.year === year)?.balance ?? null,
        makeupOwed: d.makeupOwed,
      };
    }
    if (own && this.me?.office) {
      return {
        pattern: this.me.employee?.pattern ?? null,
        office: this.me.office,
        // `/hr/me` carries only the current year's balance.
        vacation: this.me.vacation?.year === year ? this.me.vacation : null,
        makeupOwed: this.me.makeupOwed,
      };
    }
    return null;
  });

  private readonly holidays = resource({
    params: () => {
      const office = this.target()?.office.id;
      const year = Number(this.dateFrom().slice(0, 4));
      return office && year ? { office, year } : undefined;
    },
    loader: ({ params }) => this.hr.holidays(params.office, params.year),
  });

  protected readonly employeeOptions = computed<V2SelectOption[]>(() => {
    if (!this.team.hasValue()) return [];
    return this.team
      .value()
      .items.filter((row) => row.employee.isTracked)
      .map((row) => ({
        value: row.employee.id,
        label: `${hrName(row.employee)} — ${row.employee.officeCode}`,
      }));
  });

  private readonly editableFrom = computed(() => {
    if (this.admin) return null;
    return this.type() === 'makeup_day'
      ? (this.me?.editableHoursFrom ?? this.today)
      : (this.me?.editableAbsencesFrom ?? this.today);
  });

  private readonly errors = computed(() =>
    validateHrAbsence(
      {
        type: this.type(),
        dateFrom: this.dateFrom(),
        dateTo: this.dateTo(),
        part: this.part(),
        comment: this.comment(),
      },
      this.today,
      this.editableFrom(),
    ),
  );
  protected readonly invalid = computed(
    () => hasHrAbsenceErrors(this.errors()) || !this.dateFrom() || !this.dateTo(),
  );
  protected readonly errorCount = computed(() => {
    const e = this.errors();
    return [e.dateFrom || !this.dateFrom(), e.dateTo || !this.dateTo(), e.comment].filter(Boolean)
      .length;
  });

  private errorText(code: string | null): string {
    if (!code) return '';
    return this.text.ruleError(code, {
      today: this.type() === 'makeup_day' ? (this.me?.editableHoursFrom ?? this.today) : this.today,
      month: monthOf(this.dateFrom() || this.today),
      hours: this.type() === 'makeup_day',
    });
  }

  protected readonly fromError = computed(
    () => this.errorText(this.errors().dateFrom) || this.serverError(),
  );
  protected readonly toError = computed(() => this.errorText(this.errors().dateTo));
  protected readonly commentError = computed(() =>
    this.attempted() ? this.errorText(this.errors().comment) : '',
  );
  protected readonly fromHint = computed(() =>
    !this.admin && this.dateFrom() === this.today && this.type() !== 'makeup_day'
      ? this.text.t('hr.absence.todayAllowed')
      : '',
  );

  protected readonly days = computed(() => {
    const target = this.target();
    if (!target) return 0;
    return hrAbsenceDays(
      { dateFrom: this.dateFrom(), dateTo: this.dateTo(), part: this.part() },
      target.pattern,
      target.office,
      this.holidays.hasValue() ? this.holidays.value() : [],
    );
  });

  protected readonly summary = computed(() => {
    const e = this.errors();
    if (e.dateFrom || e.dateTo || !this.dateFrom() || !this.dateTo() || this.days() === 0) {
      return this.text.t('hr.absence.fixDates');
    }
    const days = this.text.plural('hr.n.workingDays', this.days());
    return this.dateFrom() === this.today
      ? `${days} · ${this.text.t('hr.absence.todaySuffix')}`
      : days;
  });

  protected readonly balance = computed<{ text: string; warn: boolean } | null>(() => {
    const target = this.target();
    const days = this.days();
    if (!target || days === 0 || this.errors().dateFrom || this.errors().dateTo) return null;
    const type = this.type();
    if (type === 'vacation' && target.vacation) {
      // The saved entry is already in `used`; count only the change.
      const before =
        this.entry?.type === 'vacation'
          ? hrAbsenceDays(
              this.entry,
              target.pattern,
              target.office,
              this.holidays.hasValue() ? this.holidays.value() : [],
            )
          : 0;
      const after = target.vacation.used + days - before;
      const limit = target.vacation.limit;
      if (after > limit) {
        return {
          text: this.text.t('hr.absence.vacationOver', {
            after: this.text.number(after),
            limit: this.text.number(limit),
            over: this.text.number(after - limit),
          }),
          warn: true,
        };
      }
      return {
        text: this.text.t('hr.absence.vacationLeft', {
          left: this.text.number(limit - after),
          limit: this.text.number(limit),
        }),
        warn: false,
      };
    }
    if (type === 'day_off_makeup' || type === 'makeup_day') {
      const owed =
        type === 'day_off_makeup'
          ? target.makeupOwed + days
          : Math.max(0, target.makeupOwed - days);
      return {
        text: this.text.t('hr.absence.makeupAfter', { n: this.text.plural('hr.n.days', owed) }),
        warn: false,
      };
    }
    return null;
  });

  protected readonly partOptions = computed<V2SegmentOption<HrDayPart>[]>(() =>
    HR_DAY_PARTS.map((part) => ({
      value: part,
      label: this.text.part(part),
      disabled: !this.single() && part !== 'full_day',
    })),
  );

  protected readonly todayNote = computed(
    () => this.dateFrom() === this.today && this.type() !== 'makeup_day',
  );

  protected readonly dirty = computed(
    () =>
      this.comment() !== (this.entry?.comment ?? '') ||
      this.type() !== (this.entry?.type ?? 'vacation') ||
      this.dateFrom() !== (this.entry?.dateFrom ?? this.data.date ?? this.today) ||
      this.dateTo() !== (this.entry?.dateTo ?? this.data.date ?? this.today),
  );

  protected setFrom(value: string): void {
    this.serverError.set('');
    this.dateFrom.set(value);
    if (!this.dateTo() || this.dateTo() < value) this.dateTo.set(value);
  }

  protected setTo(value: string): void {
    this.serverError.set('');
    this.dateTo.set(value);
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    this.attempted.set(true);
    if (this.invalid()) return;
    this.saving.set(true);
    const own = this.employeeId() === this.me?.employee?.id;
    const body = {
      ...(this.admin && !own ? { employeeId: this.employeeId() } : {}),
      type: this.type(),
      dateFrom: this.dateFrom(),
      dateTo: this.dateTo(),
      part: this.part(),
      comment: this.comment().trim() || null,
    };
    try {
      if (this.entry) await this.hr.updateAbsence(this.entry.id, body);
      else await this.hr.createAbsence(body);
      this.toast.show(this.text.t('hr.toast.saved'));
      this.dialogRef.close(true);
    } catch (error) {
      this.saving.set(false);
      this.fail(error);
    }
  }

  protected async remove(): Promise<void> {
    if (!this.entry || this.saving()) return;
    this.saving.set(true);
    try {
      await this.hr.deleteEntry(this.entry);
      this.toast.show(this.text.t('hr.toast.deleted'));
      this.dialogRef.close(true);
    } catch (error) {
      this.saving.set(false);
      this.confirmDelete.set(false);
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    if (error instanceof KolssApiError && error.code.startsWith('hr_')) {
      this.serverError.set(
        this.text.ruleError(error.code, { today: this.today, month: monthOf(this.dateFrom()) }),
      );
      return;
    }
    this.toast.show(this.text.t('hr.error.generic'));
  }
}
