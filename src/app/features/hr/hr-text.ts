import { inject, Service } from '@angular/core';

import type {
  HrCellAbsenceType,
  HrDayPart,
  HrEntryType,
  HrOffice,
  HrPattern,
} from '@core/api/generated/kolss-api.types';
import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey, MessageParams } from '@core/i18n/messages';
import type { LocaleCode } from '@domain/i18n.types';
import { hoursLabel, isoToDate, shortTime } from '@domain/hr/hr-dates';
import { v2PluralCategory } from '@domain/v2/plural';

const INTL_LOCALE: Record<LocaleCode, string> = { uk: 'uk-UA', pl: 'pl-PL', en: 'en-GB' };

/** Plural bases with `.one|few|many|other` keys in `messages.hr.*`. */
type HrPluralBase = 'hr.n.days' | 'hr.n.workingDays' | 'hr.n.people';

/** Office with either the API (`nameUk`) or the session (`name_uk`) field names. */
export type HrOfficeNames =
  Pick<HrOffice, 'nameUk' | 'namePl'> | { readonly name_uk: string; readonly name_pl: string };

/**
 * Text helpers of the HR portal: dates in the office calendar (ISO days, formatted in UTC so
 * the browser zone never shifts them), schedules, types, units and API error messages.
 */
@Service()
export class HrText {
  private readonly i18n = inject(I18nService);

  t(key: MessageKey, params?: MessageParams): string {
    return this.i18n.t(key, params);
  }

  locale(): LocaleCode {
    return this.i18n.locale();
  }

  plural(base: HrPluralBase, n: number): string {
    const category = Number.isInteger(n) ? v2PluralCategory(this.locale(), n) : 'other';
    return this.t(`${base}.${category}` as MessageKey, { n: this.number(n) });
  }

  /** Locale number with up to one decimal (0,5 in uk/pl). */
  number(n: number): string {
    return new Intl.NumberFormat(INTL_LOCALE[this.locale()], { maximumFractionDigits: 1 }).format(
      Math.round(n * 10) / 10,
    );
  }

  private format(iso: string, options: Intl.DateTimeFormatOptions): string {
    const date = iso ? isoToDate(iso) : null;
    // Empty or malformed input (e.g. before `/hr/me` brings today) renders as nothing.
    if (!date || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(INTL_LOCALE[this.locale()], { ...options, timeZone: 'UTC' })
      .format(date)
      .replace(/\.$/, '');
  }

  /** `Wed 24 Nov` */
  day(iso: string): string {
    return this.format(iso, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  }

  /** `Fri 20 Nov 2026` */
  fullDay(iso: string): string {
    return this.format(iso, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).replace(',', '');
  }

  /** `20 Nov` */
  shortDate(iso: string): string {
    return this.format(iso, { day: 'numeric', month: 'short' });
  }

  /** `20 Nov 2026` */
  date(iso: string): string {
    return this.format(iso, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** `12 Nov, 09:41` in the viewer's zone (timestamps, not calendar days). */
  dateTime(timestamp: string): string {
    return new Intl.DateTimeFormat(INTL_LOCALE[this.locale()], {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }

  /** `November 2026` (`2026-11`) */
  month(month: string): string {
    const text = this.format(`${month}-15`, { month: 'long', year: 'numeric' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /** `November` (`2026-11`) */
  monthName(month: string): string {
    const text = this.format(`${month}-15`, { month: 'long' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /** `Nov` */
  monthShort(month: string): string {
    return this.format(`${month}-15`, { month: 'short' });
  }

  /** Short weekday of an ISO weekday number (1 = Monday): `Mon`. */
  weekday(isoWeekday: number): string {
    // 2024-01-01 is a Monday.
    return this.format(`2024-01-0${isoWeekday}`, { weekday: 'short' });
  }

  weekdayOf(iso: string): string {
    return this.format(iso, { weekday: 'short' });
  }

  weekdayLetter(iso: string): string {
    return this.format(iso, { weekday: 'narrow' });
  }

  dayNumber(iso: string): string {
    return String(Number(iso.slice(8, 10)));
  }

  /** `4 h` from minutes. */
  hours(minutes: number): string {
    return this.t('hr.unit.h', { n: this.number(Number(hoursLabel(minutes))) });
  }

  /** `16 d` */
  daysShort(days: number): string {
    return this.t('hr.unit.d', { n: this.number(days) });
  }

  /** `10–18` */
  range(start: string | null, end: string | null): string {
    return `${shortTime(start)}–${shortTime(end)}`;
  }

  type(type: HrEntryType | HrCellAbsenceType): string {
    return this.t(`hr.type.${type}` as MessageKey);
  }

  part(part: HrDayPart): string {
    return this.t(`hr.part.${part}` as MessageKey);
  }

  officeName(office: HrOfficeNames | null | undefined): string {
    if (!office) return '';
    const uk = 'nameUk' in office ? office.nameUk : office.name_uk;
    const pl = 'namePl' in office ? office.namePl : office.name_pl;
    return this.locale() === 'uk' ? uk : pl;
  }

  /** `Mon–Fri`, or `Mon, Wed, Thu` when the days are not consecutive. */
  weekdays(days: readonly number[]): string {
    const sorted = [...days].sort((a, b) => a - b);
    if (sorted.length === 0) return '';
    const consecutive = sorted.every((day, i) => i === 0 || day === sorted[i - 1] + 1);
    if (consecutive && sorted.length > 2) {
      return `${this.weekday(sorted[0])}–${this.weekday(sorted[sorted.length - 1])}`;
    }
    return sorted.map((day) => this.weekday(day)).join(', ');
  }

  /** Schedule summary: `Mon–Fri · 10–18` or `3 × 6 h · flexible`. */
  schedule(pattern: HrPattern | null | undefined): string {
    if (!pattern) return this.t('hr.schedule.none');
    if (pattern.kind === 'flexible') {
      return this.t('hr.schedule.flexible', {
        days: pattern.daysPerWeek,
        hours: this.number(pattern.hoursPerDay),
      });
    }
    return this.t('hr.schedule.fixed', {
      days: this.weekdays(pattern.weekdays),
      from: shortTime(pattern.startTime),
      to: shortTime(pattern.endTime),
    });
  }

  /** Office hours of the week: `Mon–Fri 10–19, Sat 10–15`. */
  officeHours(office: HrOffice): string {
    const groups: { days: number[]; range: string }[] = [];
    for (const h of [...office.hours].sort((a, b) => a.weekday - b.weekday)) {
      if (!h.opens || !h.closes) continue;
      const range = this.range(h.opens, h.closes);
      const last = groups[groups.length - 1];
      if (last && last.range === range && last.days[last.days.length - 1] === h.weekday - 1) {
        last.days.push(h.weekday);
      } else {
        groups.push({ days: [h.weekday], range });
      }
    }
    return groups
      .map((g) =>
        g.days.length > 1
          ? `${this.weekday(g.days[0])}–${this.weekday(g.days[g.days.length - 1])} ${g.range}`
          : `${this.weekday(g.days[0])} ${g.range}`,
      )
      .join(', ');
  }

  /**
   * Message for an HR rule code (`hr_past_date`, …). `today` fills the past-date hint and
   * `month` (`YYYY-MM`) the closed-month one.
   */
  ruleError(
    code: string,
    context: { today?: string; month?: string; hours?: boolean } = {},
  ): string {
    switch (code) {
      case 'hr_past_date':
        return context.hours
          ? this.t('hr.error.hr_past_date_hours', { date: this.shortDate(context.today ?? '') })
          : this.t('hr.error.hr_past_date', { date: this.shortDate(context.today ?? '') });
      case 'hr_closed_month':
        return this.t('hr.error.hr_closed_month', {
          month: context.month ? this.monthName(context.month) : '',
        });
      case 'hr_end_before_start':
      case 'hr_comment_required':
      case 'hr_overlap':
      case 'hr_outside_office_hours':
      case 'hr_not_tracked':
      case 'hr_forbidden':
      case 'hr_already_tracked':
      case 'hr_holiday_exists':
        return this.t(`hr.error.${code}` as MessageKey);
      default:
        return this.t('hr.error.generic');
    }
  }

  /** Toast / footer text of a failed save. */
  saveError(error: unknown, context: { today?: string; month?: string } = {}): string {
    if (error instanceof KolssApiError && error.code.startsWith('hr_')) {
      return this.ruleError(error.code, context);
    }
    return this.t('hr.error.generic');
  }
}
