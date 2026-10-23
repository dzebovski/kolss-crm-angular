import type { MessageKey } from '@core/i18n/messages';
import type { V2TaskGroupKey } from '@domain/v2/task-view';
import type { V2NewTaskLinkKind } from '@domain/v2/task-form';
import type { V2TaskKind, V2TaskStatus, V2TaskView } from '@domain/v2/task.types';

/** Chip order of the board: Call-back · Visit · From comment · No next step · Task list · Personal. */
export const V2_TASK_KINDS: readonly V2TaskKind[] = [
  'call',
  'visit',
  'comment',
  'nonext',
  'list',
  'personal',
];

/**
 * "No next step" items are switched off in the API (owner decision 2026-09-29), so their source
 * chip is not offered. Flip together with `taskFeedIncludeNoNextStep` in the API.
 */
export const V2_TASK_NONEXT_ENABLED = false;

/** The source chips the page offers. */
export const V2_TASK_CHIP_KINDS: readonly V2TaskKind[] = V2_TASK_KINDS.filter(
  (kind) => V2_TASK_NONEXT_ENABLED || kind !== 'nonext',
);

export const V2_TASK_KIND_LABEL: Record<V2TaskKind, MessageKey> = {
  call: 'v2.tasks.kind.call',
  visit: 'v2.tasks.kind.visit',
  comment: 'v2.tasks.kind.comment',
  nonext: 'v2.tasks.kind.nonext',
  list: 'v2.tasks.kind.list',
  personal: 'v2.tasks.kind.personal',
};

export const V2_TASK_CHIP_LABEL: Record<V2TaskKind, MessageKey> = {
  call: 'v2.tasks.chip.call',
  visit: 'v2.tasks.chip.visit',
  comment: 'v2.tasks.chip.comment',
  nonext: 'v2.tasks.chip.nonext',
  list: 'v2.tasks.chip.list',
  personal: 'v2.tasks.chip.personal',
};

/** Source colours of the boards (`SRC`): glyph/label ink and tinted background. */
export const V2_TASK_KIND_TONE: Record<V2TaskKind, { readonly fg: string; readonly bg: string }> = {
  call: { fg: 'var(--v2-status-later)', bg: '#e8f0fa' },
  visit: { fg: 'var(--v2-status-invited)', bg: 'var(--v2-calendar-bg)' },
  comment: { fg: 'var(--v2-status-thinking)', bg: '#fbf1e1' },
  nonext: { fg: 'var(--v2-danger)', bg: 'var(--v2-danger-bg)' },
  list: { fg: 'var(--v2-ink)', bg: 'var(--v2-surface-sunk)' },
  personal: { fg: 'var(--v2-muted)', bg: 'var(--v2-surface-sunk)' },
};

export const V2_TASK_VIEW_LABEL: Record<Exclude<V2TaskView, 'list'>, MessageKey> = {
  my_day: 'v2.tasks.view.my_day',
  upcoming: 'v2.tasks.view.upcoming',
  all: 'v2.tasks.view.all',
  done: 'v2.tasks.view.done',
};

export const V2_TASK_VIEW_SUB: Record<Exclude<V2TaskView, 'list'>, MessageKey> = {
  my_day: 'v2.tasks.sub.my_day',
  upcoming: 'v2.tasks.sub.upcoming',
  all: 'v2.tasks.sub.all',
  done: 'v2.tasks.sub.done',
};

export const V2_TASK_GROUP_LABEL: Record<V2TaskGroupKey, MessageKey> = {
  overdue: 'v2.tasks.group.overdue',
  today: 'v2.tasks.group.today',
  tomorrow: 'v2.tasks.group.tomorrow',
  later: 'v2.tasks.group.later',
  nodate: 'v2.tasks.group.nodate',
  done: 'v2.tasks.group.done',
  progress: 'v2.tasks.group.progress',
  todo: 'v2.tasks.group.todo',
};

export const V2_TASK_STATUS_LABEL: Record<V2TaskStatus, MessageKey> = {
  todo: 'v2.tasks.status.todo',
  progress: 'v2.tasks.status.progress',
  done: 'v2.tasks.status.done',
};

export const V2_TASK_LINK_LABEL: Record<V2NewTaskLinkKind, MessageKey> = {
  none: 'v2.tasks.link.none',
  lead: 'v2.tasks.link.lead',
  client: 'v2.tasks.link.client',
  project: 'v2.tasks.link.project',
  list: 'v2.tasks.link.list',
};

/** Title of an automatic item that has no text of its own, by the API's `subKind`. */
export const V2_TASK_FALLBACK_TITLE: Readonly<Record<string, MessageKey>> = {
  callback: 'v2.tasks.title.callback',
  thinking: 'v2.tasks.title.thinking',
  comment: 'v2.tasks.title.comment',
  showroom: 'v2.tasks.title.showroom',
  measurement: 'v2.tasks.title.measurement',
  office_work: 'v2.tasks.title.officeWork',
  no_next_step: 'v2.tasks.title.nextStep',
};
