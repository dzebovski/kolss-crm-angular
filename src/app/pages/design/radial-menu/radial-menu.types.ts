import { UiIconName } from '../../../ui/icon/ui-icon';
import type { UiBadgeTone } from '../../../ui/feedback/ui-badge';

export type CallOutcome = 'success' | 'no_answer' | 'call_back';
export type RadialActionTone = UiBadgeTone;
export type RadialButtonAppearance = 'plain' | 'tone';
export type RadialDirection = 'clockwise' | 'counterclockwise';
export type RadialDemoVariantId = 'plain-actions' | 'five-actions' | 'seven-actions';
export type MockLeadStatus = 'new' | CallOutcome;

export interface RadialAction<TId extends string = string> {
  readonly id: TId;
  readonly label: string;
  readonly icon: UiIconName;
  readonly tone: RadialActionTone;
  readonly disabled?: boolean;
}

export interface RadialLayoutConfig<TId extends string = string> {
  readonly buttonAppearance?: RadialButtonAppearance;
  readonly radiusRem?: number;
  readonly startAngleDeg?: number;
  readonly direction?: RadialDirection;
  readonly anglesByActionId?: Readonly<Partial<Record<TId, number>>>;
  readonly gridWidthRem?: number;
  readonly gridHeightRem?: number;
}

export interface CallAction extends RadialAction<CallOutcome> {
  readonly resultLabel: string;
  readonly requiresComment: boolean;
}

export interface RadialDemoVariant {
  readonly id: RadialDemoVariantId;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly actions: readonly RadialAction[];
  readonly layout?: RadialLayoutConfig;
}

export interface MockLeadState {
  readonly status: MockLeadStatus;
  readonly comment: string;
}

export interface CallActionResult {
  readonly outcome: CallOutcome;
  readonly comment: string;
}

export const CALL_RADIAL_LAYOUT: RadialLayoutConfig = {
  buttonAppearance: 'tone',
  radiusRem: 12,
  gridWidthRem: 30,
  gridHeightRem: 23,
};

export const CALL_ACTIONS: readonly CallAction[] = [
  {
    id: 'success',
    label: 'Успішний',
    resultLabel: 'Успішний',
    icon: 'check_circle',
    tone: 'success',
    requiresComment: true,
  },
  {
    id: 'no_answer',
    label: 'Не дозвонилися',
    resultLabel: 'Не дозвонилися',
    icon: 'phone_missed',
    tone: 'danger',
    requiresComment: false,
  },
  {
    id: 'call_back',
    label: 'Передзвонити',
    resultLabel: 'Передзвонити',
    icon: 'schedule',
    tone: 'brand',
    requiresComment: false,
  },
] as const;

const MEETING_ACTION: RadialAction = {
  id: 'schedule_meeting',
  label: 'Запланувати зустріч',
  icon: 'calendar_month',
  tone: 'info',
};

const MESSAGE_ACTION: RadialAction = {
  id: 'send_message',
  label: 'Надіслати повідомлення',
  icon: 'campaign',
  tone: 'warning',
};

const INVALID_NUMBER_ACTION: RadialAction = {
  id: 'invalid_number',
  label: 'Невірний номер',
  icon: 'warning',
  tone: 'warning',
};

const DECLINED_ACTION: RadialAction = {
  id: 'declined',
  label: 'Відмова',
  icon: 'error',
  tone: 'neutral',
};

const FIVE_ACTIONS: readonly RadialAction[] = [...CALL_ACTIONS, MEETING_ACTION, MESSAGE_ACTION];

export const RADIAL_DEMO_VARIANTS: readonly RadialDemoVariant[] = [
  {
    id: 'plain-actions',
    eyebrow: 'Style test · Plain',
    title: 'Білі кнопки',
    description: 'Дефолтний нейтральний вигляд із тими самими labels та іконками.',
    actions: CALL_ACTIONS,
    layout: {
      radiusRem: 12,
      gridWidthRem: 30,
      gridHeightRem: 23,
    },
  },
  {
    id: 'five-actions',
    eyebrow: 'Scale test · 05',
    title: 'Пʼять напрямків',
    description: 'Перевірка рівномірного ритму без ручного позиціонування.',
    actions: FIVE_ACTIONS,
    layout: { buttonAppearance: 'tone' },
  },
  {
    id: 'seven-actions',
    eyebrow: 'Scale test · 07',
    title: 'Сім напрямків',
    description: 'Максимально щільний сценарій для desktop radial і mobile list.',
    actions: [...FIVE_ACTIONS, INVALID_NUMBER_ACTION, DECLINED_ACTION],
    layout: { buttonAppearance: 'tone' },
  },
] as const;
