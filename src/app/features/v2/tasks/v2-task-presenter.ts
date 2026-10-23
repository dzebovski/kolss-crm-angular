import type { LocaleCode } from '@domain/i18n.types';
import type { MessageKey, MessageParams } from '@core/i18n/messages';
import { formatV2CardDate } from '@domain/v2/date-format';
import { v2PluralCategory } from '@domain/v2/plural';
import type { V2TaskDue } from '@domain/v2/task-view';
import type { V2Task } from '@domain/v2/task.types';
import { V2_TASK_FALLBACK_TITLE } from './v2-task-labels';

type Translate = (key: MessageKey, params?: MessageParams) => string;

export interface V2TaskDueView {
  readonly primary: string;
  readonly secondary: string;
  /** Red for overdue items and a passed time today. */
  readonly danger: boolean;
  readonly muted: boolean;
}

/** The due column of a row and the panel's red note (board `dueOf`). */
export function v2TaskDueView(
  due: V2TaskDue,
  now: Date,
  locale: LocaleCode,
  t: Translate,
): V2TaskDueView {
  switch (due.kind) {
    case 'none':
      return { primary: t('v2.tasks.due.none'), secondary: '', danger: false, muted: true };
    case 'overdue': {
      const category = v2PluralCategory(locale, due.days);
      const date = formatV2CardDate(due.date, now, locale);
      return {
        primary: t(`v2.tasks.due.overdue.${category}`, { count: due.days }),
        secondary: due.time ? `${date}, ${due.time}` : date,
        danger: true,
        muted: false,
      };
    }
    case 'today':
      return {
        primary: due.time ?? t('v2.tasks.due.today'),
        secondary: due.late
          ? t('v2.tasks.due.timePassed')
          : due.time
            ? t('v2.tasks.due.today')
            : '',
        danger: due.late,
        muted: false,
      };
    case 'tomorrow':
      return {
        primary: t('v2.tasks.due.tomorrow'),
        secondary: due.time ?? '',
        danger: false,
        muted: false,
      };
    case 'date':
      return {
        primary: formatV2CardDate(due.date, now, locale),
        secondary: due.time ?? '',
        danger: false,
        muted: false,
      };
  }
}

/** A task's own text, else the title its `subKind` implies (call-backs, visits). */
export function v2TaskTitle(task: V2Task, t: Translate): string {
  if (task.title) return task.title;
  const key = V2_TASK_FALLBACK_TITLE[task.subKind];
  return key ? t(key) : t('v2.tasks.title.untitled');
}

export function v2Initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase();
}

const NAME_LOCALE: Record<LocaleCode, string> = { en: 'en-US', uk: 'uk-UA', pl: 'pl-PL' };

/** Page subtitle date: `Friday, 25 September`. */
export function v2LongDate(date: Date, locale: LocaleCode): string {
  const text = new Intl.DateTimeFormat(NAME_LOCALE[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return text.charAt(0).toLocaleUpperCase(NAME_LOCALE[locale]) + text.slice(1);
}
