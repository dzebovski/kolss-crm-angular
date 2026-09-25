import { afterNextRender, Component, computed, ElementRef, inject, signal } from '@angular/core';

import { OFFICE_CONFIG } from '@core/office/office.config';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { OfficeId } from '@domain/office.types';
import { v2BudgetRangeOrderInvalid } from '@domain/v2/budget-mask';
import { v2IsPastDateTime } from '@domain/v2/date-chips';
import { v2IsValidEmailInput } from '@domain/v2/email-check';
import type { V2LeadDisplayStatus, V2LeadRating } from '@domain/v2/lead-view.types';
import { v2PhoneInfo, v2ValidatePhone } from '@domain/v2/phone-mask';
import { v2PluralCategory } from '@domain/v2/plural';
import { V2_NOW } from '../core/v2-clock';
import { V2DialogService } from '../ui/dialog/v2-dialog.service';
import { V2FieldGroup } from '../ui/dialog/v2-field-group';
import { V2FormField } from '../ui/dialog/v2-form-field';
import { V2Button } from '../ui/v2-button';
import { V2BudgetInput } from '../ui/v2-budget-input';
import { V2CardSelect, type V2CardSelectOption } from '../ui/v2-card-select';
import { V2ChipGroup } from '../ui/v2-chip-group';
import { V2ChipSelect, type V2ChipOption } from '../ui/v2-chip-select';
import { V2CodeChip } from '../ui/v2-code-chip';
import { V2DateTile } from '../ui/v2-date-tile';
import { V2DateTimeInput } from '../ui/v2-date-time-input';
import { V2EmptyState } from '../ui/v2-empty-state';
import { V2FilterChip } from '../ui/v2-filter-chip';
import { V2InfoCard } from '../ui/v2-info-card';
import { V2PhoneInput } from '../ui/v2-phone-input';
import { V2RatingPill } from '../ui/v2-rating-pill';
import { V2RatingSwitch } from '../ui/v2-rating-switch';
import { V2SearchField } from '../ui/v2-search-field';
import { V2SegmentedControl, type V2SegmentOption } from '../ui/v2-segmented-control';
import { V2Select, type V2SelectOption } from '../ui/v2-select';
import { V2StatusPill } from '../ui/v2-status-pill';
import {
  V2TimelineEntry,
  type V2TimelineChange,
  type V2TimelineRow,
} from '../ui/v2-timeline-entry';
import { V2_STATUS_LABEL } from '../ui/v2-tone';
import {
  V2_COLOR_GROUPS,
  V2_DESIGN_SYSTEM_URL,
  V2_RADIUS_TOKENS,
  V2_SHADOW_TOKENS,
  V2_SIZE_TOKENS,
  V2_SPACING_TOKENS,
  V2_TYPE_GROUPS,
} from './v2-design-catalog';
import { V2DesignDemoDialog } from './v2-design-demo-dialog';

type DemoPeriod = 'week' | 'month' | 'd40' | 'custom';

const PERIOD_LABEL: Record<DemoPeriod, MessageKey> = {
  week: 'v2.leads.period.week',
  month: 'v2.leads.period.month',
  d40: 'v2.leads.period.d40',
  custom: 'v2.leads.period.custom',
};

const STATUSES: readonly V2LeadDisplayStatus[] = [
  'new',
  'later',
  'noanswer',
  'success',
  'thinking',
  'invited',
  'lost',
  'project',
];

const LEGACY_STATUSES: readonly V2LeadDisplayStatus[] = [
  'measurement_scheduled',
  'calculation_in_progress',
  'postponed',
  'contract_signed',
];

// Create-lead.dc.html `SOURCES` / `PRODUCTS` — sample option lists for the G3 chip controls.
// Demo-only English labels (like the timeline sample data above), not user-facing v2 copy.
const SOURCE_OPTIONS: readonly V2ChipOption[] = [
  { id: 'office', label: 'Office' },
  { id: 'phone', label: 'Phone' },
  { id: 'website', label: 'Website' },
  { id: 'meta_ads', label: 'Meta Ads' },
  { id: 'google_ads', label: 'Google Ads' },
  { id: 'referral', label: 'Referral' },
];
const PRODUCT_OPTIONS: readonly V2ChipOption[] = [
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'wardrobe', label: 'Wardrobe' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'hallway', label: 'Hallway' },
  { id: 'other', label: 'Other' },
];

// The v2 design system page (`/v2/design`): the tokens of `src/styles/v2/` and every
// component of the v2 UI kit, live, so states (hover, press, focus, disabled) can be tried.
// Token values are read from the rendered custom properties, never typed twice.
@Component({
  selector: 'app-v2-design-page',
  imports: [
    TranslatePipe,
    V2Button,
    V2BudgetInput,
    V2CardSelect,
    V2ChipGroup,
    V2ChipSelect,
    V2CodeChip,
    V2DateTile,
    V2DateTimeInput,
    V2EmptyState,
    V2FieldGroup,
    V2FilterChip,
    V2FormField,
    V2InfoCard,
    V2PhoneInput,
    V2RatingPill,
    V2RatingSwitch,
    V2SearchField,
    V2SegmentedControl,
    V2Select,
    V2StatusPill,
    V2TimelineEntry,
  ],
  templateUrl: './v2-design-page.html',
  styleUrl: './v2-design-page.scss',
})
export class V2DesignPage {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialogs = inject(V2DialogService);
  private readonly i18n = inject(I18nService);
  private readonly now = inject(V2_NOW);

  protected readonly sourceUrl = V2_DESIGN_SYSTEM_URL;
  protected readonly colorGroups = V2_COLOR_GROUPS;
  protected readonly typeGroups = V2_TYPE_GROUPS;
  protected readonly spacing = V2_SPACING_TOKENS;
  protected readonly radii = V2_RADIUS_TOKENS;
  protected readonly shadows = V2_SHADOW_TOKENS;
  protected readonly sizes = V2_SIZE_TOKENS;
  protected readonly statuses = STATUSES;
  protected readonly legacyStatuses = LEGACY_STATUSES;
  protected readonly chipStatuses = STATUSES.slice(0, 4);
  protected readonly statusLabels = V2_STATUS_LABEL;
  protected readonly ratings: readonly V2LeadRating[] = ['cold', 'medium', 'hot'];

  /** `--v2-<name>` values as the browser resolved them. */
  protected readonly values = signal<Readonly<Record<string, string>>>({});
  /** Rendered size / line height / weight of each type style sample. */
  protected readonly typeSpecs = signal<Readonly<Record<string, string>>>({});

  // Live demo state.
  protected readonly period = signal<DemoPeriod>('month');
  protected readonly periodOptions = computed<readonly V2SegmentOption<DemoPeriod>[]>(() => {
    this.i18n.locale();
    return (Object.keys(PERIOD_LABEL) as DemoPeriod[]).map((value) => ({
      value,
      label: this.i18n.t(PERIOD_LABEL[value]),
      // Shows the disabled segment.
      disabled: value === 'custom',
    }));
  });
  protected readonly rating = signal<V2LeadRating | null>('medium');
  protected readonly search = signal('');
  protected readonly selectedChips = signal<ReadonlySet<V2LeadDisplayStatus>>(new Set(['later']));

  // G3 form controls (Popup-rules.dc.html "Masks and formats").
  protected readonly demoOfficeId = signal<OfficeId>('warsaw');
  protected readonly demoOffice = computed(() => OFFICE_CONFIG[this.demoOfficeId()]);
  protected readonly demoPhone = signal('');
  protected readonly demoPhoneTouched = signal(false);
  protected readonly demoPhoneHint = computed(() => {
    const info = v2PhoneInfo(this.demoPhone());
    if (info.cc === '+380') return this.i18n.t('v2.form.phone.hint.ua');
    if (info.cc === '+48') return this.i18n.t('v2.form.phone.hint.pl');
    return this.i18n.t('v2.form.phone.hint.generic');
  });
  protected readonly demoPhoneError = computed(() => {
    if (!this.demoPhoneTouched()) return '';
    const result = v2ValidatePhone(this.demoPhone());
    if (result.kind === 'ok') return '';
    if (result.kind === 'empty') return this.i18n.t('v2.form.phone.error.empty');
    if (result.kind === 'noCode') return this.i18n.t('v2.form.phone.error.noCode');
    const category = v2PluralCategory(this.i18n.locale(), result.missingDigits);
    return this.i18n.t(`v2.form.phone.error.incomplete.${category}`, {
      count: result.missingDigits,
    });
  });

  protected readonly demoEmail = signal('anna.melnyk@gmail');
  protected readonly demoEmailTouched = signal(false);
  protected readonly demoEmailError = computed(() =>
    this.demoEmailTouched() && !v2IsValidEmailInput(this.demoEmail())
      ? this.i18n.t('v2.form.email.error')
      : '',
  );

  protected readonly demoBudget = signal('');
  protected readonly demoBudgetCurrency = signal(OFFICE_CONFIG.warsaw.defaultBudgetCurrency);
  protected readonly demoBudgetError = computed(() =>
    v2BudgetRangeOrderInvalid(this.demoBudget())
      ? this.i18n.t('v2.form.budget.error.rangeOrder')
      : '',
  );

  protected readonly demoDateTime = signal('');
  protected readonly demoDateTouched = signal(false);
  protected readonly demoDateError = computed(() => {
    if (!this.demoDateTouched() || !this.demoDateTime()) return '';
    const [datePart, timePart] = this.demoDateTime().split('T');
    if (!datePart) return this.i18n.t('v2.form.date.error.addDate');
    if (!timePart) return this.i18n.t('v2.form.date.error.addTime');
    const value = new Date(this.demoDateTime());
    return v2IsPastDateTime(value, this.now()) ? this.i18n.t('v2.form.date.error.pastTime') : '';
  });

  protected readonly demoShowroomId = signal('');
  protected readonly showroomOptions = computed<readonly V2CardSelectOption[]>(() =>
    (Object.values(OFFICE_CONFIG) as (typeof OFFICE_CONFIG)[OfficeId][]).map((office) => ({
      id: office.id,
      label: this.i18n.t(office.showroomCardLabelKey),
      sub: this.i18n.t(office.showroomCardSubKey),
    })),
  );
  protected readonly demoSource = signal('office');
  protected readonly sourceOptions = SOURCE_OPTIONS;
  protected readonly demoProducts = signal<readonly string[]>(['kitchen']);
  protected readonly productOptions = PRODUCT_OPTIONS;
  protected readonly demoSelectValue = signal('zł');
  protected readonly demoSelectOptions: readonly V2SelectOption[] = [
    { value: 'zł', label: 'zł' },
    { value: '$', label: '$' },
    { value: '€', label: '€' },
    { value: '₴', label: '₴' },
  ];

  // Sample timeline entry (design system TimelineEntry preview); names and dates are sample data.
  protected readonly timelineChange = computed<V2TimelineChange>(() => {
    this.i18n.locale();
    return {
      from: { label: this.i18n.t('v2.status.success'), tone: 'success' },
      to: { label: this.i18n.t('v2.status.invited'), tone: 'invited' },
    };
  });
  protected readonly timelineRows = computed<readonly V2TimelineRow[]>(() => {
    this.i18n.locale();
    return [
      { key: this.i18n.t('v2.current.when'), value: 'Sat 26 Sep, 12:00–13:00' },
      { key: this.i18n.t('v2.current.designer'), value: 'Slawek Szewchuk' },
    ];
  });

  constructor() {
    afterNextRender(() => this.readRenderedValues());
  }

  protected onDemoEmailInput(event: Event): void {
    this.demoEmail.set((event.target as HTMLInputElement).value);
  }

  protected pickDemoOffice(id: OfficeId): void {
    this.demoOfficeId.set(id);
    this.demoBudgetCurrency.set(OFFICE_CONFIG[id].defaultBudgetCurrency);
  }

  protected toggleChip(status: V2LeadDisplayStatus): void {
    this.selectedChips.update((current) => {
      const next = new Set(current);
      if (!next.delete(status)) next.add(status);
      return next;
    });
  }

  protected openDemoDialog(): void {
    this.dialogs.open(V2DesignDemoDialog);
  }

  private readRenderedValues(): void {
    const element = this.host.nativeElement;
    const style = getComputedStyle(element);
    const names = [
      ...this.colorGroups.flatMap((group) => group.tokens),
      ...this.spacing,
      ...this.radii,
      ...this.shadows,
      ...this.sizes,
    ].map((token) => token.name);
    this.values.set(
      Object.fromEntries(
        names.map((name) => [name, style.getPropertyValue(`--v2-${name}`).trim()]),
      ),
    );

    const specs: Record<string, string> = {};
    element.querySelectorAll<HTMLElement>('[data-type-sample]').forEach((sample) => {
      const sampleStyle = getComputedStyle(sample);
      specs[sample.dataset['typeSample'] ?? ''] =
        `${sampleStyle.fontSize} / ${sampleStyle.lineHeight} · ${sampleStyle.fontWeight}`;
    });
    this.typeSpecs.set(specs);
  }
}
