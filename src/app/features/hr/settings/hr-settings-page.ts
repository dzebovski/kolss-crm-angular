import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { HrHoliday, HrOfficeHours } from '@core/api/generated/kolss-api.types';
import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { isoWeekday, timeOptions, timeToMinutes } from '@domain/hr/hr-dates';
import { HrService } from '@services/hr/hr.service';
import { V2FormField } from '../../v2/ui/dialog/v2-form-field';
import { V2Button } from '../../v2/ui/v2-button';
import { V2SegmentedControl, type V2SegmentOption } from '../../v2/ui/v2-segmented-control';
import { V2StatePanel } from '../../v2/ui/v2-state-panel';
import { V2ToastService } from '../../v2/ui/toast/v2-toast';
import { HrDialogs } from '../dialogs/hr-dialogs';
import { HrSession } from '../hr-session';
import { HrText } from '../hr-text';

interface HrHoursDraft {
  readonly weekday: number;
  readonly open: boolean;
  readonly opens: string;
  readonly closes: string;
}

const TIMES = timeOptions('06:00', '22:00');

// HR settings (HR-settings.dc.html, super admin), per office (query param `office`): office
// hours (7 days, switch + 30-minute selects), vacation default, holidays and closed days by year.
@Component({
  selector: 'app-hr-settings-page',
  imports: [TranslatePipe, V2Button, V2FormField, V2SegmentedControl, V2StatePanel],
  templateUrl: './hr-settings-page.html',
  styleUrl: './hr-settings-page.scss',
})
export class HrSettingsPage {
  private readonly hr = inject(HrService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(HrDialogs);
  private readonly toast = inject(V2ToastService);
  protected readonly session = inject(HrSession);
  protected readonly text = inject(HrText);

  readonly office = input<string>();

  protected readonly times = TIMES;
  protected readonly officeId = computed(() => this.office() || this.session.defaultOfficeId());
  protected readonly year = linkedSignal(() =>
    Number((this.session.value()?.today ?? '2026').slice(0, 4)),
  );
  protected readonly savingHours = signal(false);
  protected readonly savingVacation = signal(false);
  protected readonly confirmId = signal<string | null>(null);

  protected readonly settings = resource({
    params: () => (this.officeId() ? { id: this.officeId(), v: this.hr.changes() } : undefined),
    loader: ({ params }) => this.hr.settings(params.id),
  });
  protected readonly data = computed(() =>
    this.settings.hasValue() ? this.settings.value() : undefined,
  );

  protected readonly holidays = resource({
    params: () =>
      this.officeId()
        ? { id: this.officeId(), year: this.year(), v: this.hr.changes() }
        : undefined,
    loader: ({ params }) => this.hr.holidays(params.id, params.year),
  });

  protected readonly hours = linkedSignal<readonly HrHoursDraft[]>(() =>
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
      const h = this.data()?.hours.find((x) => x.weekday === weekday);
      return {
        weekday,
        open: !!h?.opens && !!h?.closes,
        opens: h?.opens?.slice(0, 5) ?? '10:00',
        closes: h?.closes?.slice(0, 5) ?? '18:00',
      };
    }),
  );
  protected readonly vacationText = linkedSignal(() =>
    String(this.data()?.defaultVacationDays ?? ''),
  );

  protected readonly officeTabs = computed(() =>
    this.session.offices().map((o) => ({
      id: o.id,
      label: this.text.officeName(o),
      active: o.id === this.officeId(),
    })),
  );
  protected readonly yearOptions = computed<V2SegmentOption<string>[]>(() => {
    const now = Number((this.session.value()?.today ?? '2026').slice(0, 4));
    return [now - 1, now, now + 1].map((y) => ({ value: String(y), label: String(y) }));
  });

  protected readonly hoursErrors = computed(
    () =>
      new Set(
        this.hours()
          .filter((h) => h.open && (timeToMinutes(h.closes) ?? 0) <= (timeToMinutes(h.opens) ?? 0))
          .map((h) => h.weekday),
      ),
  );
  private readonly vacationDays = computed(() => {
    const text = this.vacationText().trim();
    const n = Number(text.replace(',', '.'));
    return text && Number.isFinite(n) && n >= 0 && n <= 366 && (n * 2) % 1 === 0 ? n : null;
  });
  protected readonly vacationInvalid = computed(() => this.vacationDays() === null);

  protected readonly holidayRows = computed(() =>
    (this.holidays.hasValue() ? [...this.holidays.value()] : [])
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((h) => ({
        holiday: h,
        date: this.text.day(h.day),
        sunday: isoWeekday(h.day) === 7,
        kind: this.text.t(
          h.kind === 'public_holiday'
            ? 'hr.holiday.kind.public_holiday'
            : 'hr.holiday.kind.office_closed',
        ),
      })),
  );

  protected readonly errorCode = computed(() => {
    const error = this.settings.error();
    return error instanceof KolssApiError ? error.code : 'network_error';
  });

  protected setOffice(office: string): void {
    void this.router.navigate([], { queryParams: { office }, queryParamsHandling: 'merge' });
  }

  protected patchDay(weekday: number, change: Partial<HrHoursDraft>): void {
    this.hours.update((list) => list.map((h) => (h.weekday === weekday ? { ...h, ...change } : h)));
  }

  protected saveHours(): Promise<void> {
    if (this.hoursErrors().size > 0) return Promise.resolve();
    return this.put('hours');
  }

  protected saveVacation(): Promise<void> {
    if (this.vacationInvalid()) return Promise.resolve();
    return this.put('vacation');
  }

  /** PUT settings sends both parts; the untouched part keeps its saved value. */
  private async put(part: 'hours' | 'vacation'): Promise<void> {
    const data = this.data();
    if (!data) return;
    const saving = part === 'hours' ? this.savingHours : this.savingVacation;
    if (saving()) return;
    saving.set(true);
    const hours: HrOfficeHours[] =
      part === 'hours'
        ? this.hours().map((h) => ({
            weekday: h.weekday,
            opens: h.open ? h.opens : null,
            closes: h.open ? h.closes : null,
          }))
        : [...data.hours];
    try {
      await this.hr.putSettings(data.id, {
        defaultVacationDays:
          part === 'vacation'
            ? (this.vacationDays() ?? data.defaultVacationDays)
            : data.defaultVacationDays,
        hours,
      });
      this.toast.show(this.text.t('hr.toast.saved'));
    } catch (error) {
      this.toast.show(this.text.saveError(error));
    } finally {
      saving.set(false);
    }
  }

  protected addHoliday(): void {
    this.dialogs.holiday({ officeId: this.officeId(), year: this.year() });
  }

  protected editHoliday(holiday: HrHoliday): void {
    this.dialogs.holiday({ officeId: this.officeId(), year: this.year(), holiday });
  }

  protected async deleteHoliday(holiday: HrHoliday): Promise<void> {
    this.confirmId.set(null);
    try {
      await this.hr.deleteHoliday(holiday.id);
      this.toast.show(this.text.t('hr.toast.deleted'));
    } catch (error) {
      this.toast.show(this.text.saveError(error));
    }
  }
}
