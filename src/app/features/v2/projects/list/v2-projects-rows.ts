import type { MessageKey } from '@core/i18n/messages';
import type { LocaleCode } from '@domain/i18n.types';
import { calendarDayDiff, formatV2CardDate, formatV2RelativeTime } from '@domain/v2/date-format';
import type { V2LeadProduct } from '@domain/v2/lead-card.types';
import { v2Initials } from '@domain/v2/lead-list.rules';
import { v2ProjectNextEvent, type V2ProjectNextEvent } from '@domain/v2/project-status';
import type { V2ProjectListItem, V2ProjectSchedule } from '@domain/v2/project.types';
import { V2_PRODUCT_LABEL } from '../../ui/v2-lead-labels';

/** What a table row and a kanban card show for one project. */
export interface V2ProjectRow {
  readonly project: V2ProjectListItem;
  readonly created: string;
  /** Products as one title (`Kitchen + wardrobe`), empty without products. */
  readonly title: string;
  readonly managerInitials: string;
  readonly next: V2ProjectNextEvent;
  readonly nextDay: string;
  readonly commentAge: string;
}

export function toV2ProjectRow(
  project: V2ProjectListItem,
  now: Date,
  locale: LocaleCode,
  t: (key: MessageKey) => string,
): V2ProjectRow {
  const next = v2ProjectNextEvent(project, now);
  return {
    project,
    created: formatV2CardDate(project.createdAt, now, locale),
    title: joinV2ProductLabels(
      project.products.map((product) => {
        const key = V2_PRODUCT_LABEL[product as V2LeadProduct] as MessageKey | undefined;
        return key ? t(key) : product;
      }),
    ),
    managerInitials: project.manager ? v2Initials(project.manager.name) : '',
    next,
    nextDay: next.kind === 'planned' ? formatV2ProjectSchedule(next.schedule, now, locale) : '',
    commentAge: project.lastComment
      ? formatV2RelativeTime(project.lastComment.at, now, locale)
      : '',
  };
}

const NAME_LOCALE: Record<LocaleCode, string> = { en: 'en-US', uk: 'uk-UA', pl: 'pl-PL' };

/** `YYYY-MM-DD` (office-local) as a local-midnight date. */
export function v2LocalDate(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

/**
 * Next-event day as on the Projects-list board: Today / Tomorrow / Yesterday (localized), then the
 * card date rule (`Sat 29 Sep` within a week, `12 Oct` this month, `15/11` this year).
 * The time, when there is one, follows after a comma.
 */
export function formatV2ProjectSchedule(
  schedule: V2ProjectSchedule,
  now: Date,
  locale: LocaleCode,
): string {
  const date = v2LocalDate(schedule.date);
  const diff = calendarDayDiff(date, now);
  const day =
    diff >= -1 && diff <= 1
      ? capitalize(
          new Intl.RelativeTimeFormat(NAME_LOCALE[locale], { numeric: 'auto' }).format(diff, 'day'),
        )
      : formatV2CardDate(date, now, locale);
  return schedule.time ? `${day}, ${schedule.time.slice(0, 5)}` : day;
}

/** Product tags as one title: `Kitchen + wardrobe` (only the first label keeps its capital). */
export function joinV2ProductLabels(labels: readonly string[]): string {
  return labels
    .map((label, index) =>
      index === 0 ? label : label.charAt(0).toLocaleLowerCase() + label.slice(1),
    )
    .join(' + ');
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}
