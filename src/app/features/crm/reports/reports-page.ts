import { Component, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { SessionService } from '@core/session/session.service';
import {
  CALL_STATUS_FILTER_KEYS,
  SELECTABLE_CLIENT_STATUS_FILTER_KEYS,
  type CallStatusFilterKey,
  type SelectableClientStatusFilterKey,
} from '@domain/lead-filters';
import { UiButton } from '@ui/button/ui-button';
import { UiAlert } from '@ui/feedback/ui-alert';
import { UiMultiSelect, type UiMultiSelectOption } from '@ui/form/ui-multi-select';
import { UiSwitch } from '@ui/form/ui-switch';
import { UiTextField } from '@ui/form/ui-text-field';
import { ManagerReportSection } from './manager-report-section';
import { ReportSummary } from './report-summary';
import { ReportsService } from './reports.service';
import type {
  AppliedReportCriteria,
  CalendarReportPeriodMode,
  ReportCohort,
  ReportCriteriaLabels,
  ReportPeriod,
  ReportPeriodMode,
} from './reports.types';

interface ReportsCriteriaFormModel {
  readonly cohort: ReportCohort;
  readonly activityPeriodMode: ReportPeriodMode;
  readonly activityMonth: string;
  readonly activityFrom: string;
  readonly activityTo: string;
  readonly calendarPeriodMode: CalendarReportPeriodMode;
  readonly calendarMonth: string;
  readonly calendarFrom: string;
  readonly calendarTo: string;
  readonly callStatuses: readonly CallStatusFilterKey[];
  readonly clientStatuses: readonly SelectableClientStatusFilterKey[];
  readonly activeClientsOnly: boolean;
}

@Component({
  selector: 'app-reports-page',
  imports: [
    FormField,
    ManagerReportSection,
    ReportSummary,
    TranslatePipe,
    UiAlert,
    UiButton,
    UiMultiSelect,
    UiSwitch,
    UiTextField,
  ],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.scss',
})
export class ReportsPage {
  private readonly session = inject(SessionService);
  private readonly reports = inject(ReportsService);
  protected readonly i18n = inject(I18nService);

  private readonly initialMonth = this.currentMonthValue();
  protected readonly criteriaModel = signal<ReportsCriteriaFormModel>({
    cohort: 'activity',
    activityPeriodMode: 'all',
    activityMonth: this.initialMonth,
    activityFrom: '',
    activityTo: '',
    calendarPeriodMode: 'month',
    calendarMonth: this.initialMonth,
    calendarFrom: '',
    calendarTo: '',
    callStatuses: [],
    clientStatuses: [],
    activeClientsOnly: false,
  });
  protected readonly criteriaForm = form(this.criteriaModel, (path) => {
    validate(path.activityMonth, ({ value, valueOf }) =>
      valueOf(path.cohort) === 'activity' &&
      valueOf(path.activityPeriodMode) === 'month' &&
      !this.monthBounds(value())
        ? { kind: 'required', message: this.i18n.t('reports.validation.monthRequired') }
        : undefined,
    );
    validate(path.activityFrom, ({ value, valueOf }) =>
      valueOf(path.cohort) === 'activity' &&
      valueOf(path.activityPeriodMode) === 'custom' &&
      !value()
        ? { kind: 'required', message: this.i18n.t('reports.validation.rangeRequired') }
        : undefined,
    );
    validate(path.activityTo, ({ value, valueOf }) =>
      this.rangeError(
        valueOf(path.cohort) === 'activity' && valueOf(path.activityPeriodMode) === 'custom',
        valueOf(path.activityFrom),
        value(),
      ),
    );
    validate(path.calendarMonth, ({ value, valueOf }) =>
      valueOf(path.cohort) === 'calendar' &&
      valueOf(path.calendarPeriodMode) === 'month' &&
      !this.monthBounds(value())
        ? { kind: 'required', message: this.i18n.t('reports.validation.monthRequired') }
        : undefined,
    );
    validate(path.calendarFrom, ({ value, valueOf }) =>
      valueOf(path.cohort) === 'calendar' &&
      valueOf(path.calendarPeriodMode) === 'custom' &&
      !value()
        ? { kind: 'required', message: this.i18n.t('reports.validation.rangeRequired') }
        : undefined,
    );
    validate(path.calendarTo, ({ value, valueOf }) =>
      this.rangeError(
        valueOf(path.cohort) === 'calendar' && valueOf(path.calendarPeriodMode) === 'custom',
        valueOf(path.calendarFrom),
        value(),
      ),
    );
  });

  private readonly appliedCriteria = signal<AppliedReportCriteria>({
    cohort: 'activity',
    period: { from: null, to: null },
    callStatuses: [],
    clientStatuses: [],
  });
  private previousActiveClientsOnly = false;
  private previousClientStatusesKey = '';

  protected readonly activityPeriodModes = [
    { value: 'all', label: 'reports.period.allTime' },
    { value: 'month', label: 'reports.period.calendarMonth' },
    { value: 'custom', label: 'reports.period.custom' },
  ] as const;
  protected readonly calendarPeriodModes = [
    { value: 'month', label: 'reports.period.calendarMonth' },
    { value: 'custom', label: 'reports.period.custom' },
  ] as const;

  protected readonly callStatusOptions = computed((): readonly UiMultiSelectOption[] => {
    this.i18n.locale();
    return CALL_STATUS_FILTER_KEYS.map((status) => ({
      value: status,
      label: this.callStatusFilterLabel(status),
    }));
  });
  protected readonly clientStatusOptions = computed((): readonly UiMultiSelectOption[] => {
    this.i18n.locale();
    return SELECTABLE_CLIENT_STATUS_FILTER_KEYS.map((status) => ({
      value: status,
      label: this.clientStatusFilterLabel(status),
    }));
  });
  protected readonly filterSummaryLabel = computed(() => {
    this.i18n.locale();
    return (count: number) => this.i18n.t('leads.filter.selectedCount', { count });
  });

  protected readonly reportResource = resource({
    params: () => ({ officeId: this.session.selectedOfficeId(), criteria: this.appliedCriteria() }),
    loader: ({ params }) => this.reports.load(params.officeId, params.criteria),
  });

  protected readonly loadError = computed(() => {
    const error = this.reportResource.error();
    return error instanceof Error
      ? this.i18n.localizeError(error.message)
      : error
        ? String(error)
        : '';
  });

  protected readonly criteriaLabels = computed((): ReportCriteriaLabels => {
    const criteria = this.appliedCriteria();
    return {
      cohort: this.i18n.t(`reports.cohort.${criteria.cohort}`),
      period: this.formatPeriod(criteria.period),
      callStatuses: this.formatStatusList(
        criteria.callStatuses.map((status) => this.callStatusFilterLabel(status)),
      ),
      clientStatuses: this.formatStatusList(
        criteria.clientStatuses.map((status) => this.clientStatusFilterLabel(status)),
      ),
    };
  });

  constructor() {
    effect(() => {
      const model = this.criteriaModel();
      const statusesKey = model.clientStatuses.join(',');
      const activeChanged = model.activeClientsOnly !== this.previousActiveClientsOnly;
      const statusesChanged = statusesKey !== this.previousClientStatusesKey;

      this.previousActiveClientsOnly = model.activeClientsOnly;
      this.previousClientStatusesKey = statusesKey;

      if (!model.activeClientsOnly || model.clientStatuses.length === 0) return;
      untracked(() => {
        if (activeChanged) {
          this.criteriaModel.update((value) => ({ ...value, clientStatuses: [] }));
          this.previousClientStatusesKey = '';
        } else if (statusesChanged) {
          this.criteriaModel.update((value) => ({ ...value, activeClientsOnly: false }));
          this.previousActiveClientsOnly = false;
        }
      });
    });
  }

  protected selectCohort(cohort: ReportCohort): void {
    this.criteriaModel.update((value) => ({ ...value, cohort }));
  }

  protected selectActivityPeriodMode(activityPeriodMode: ReportPeriodMode): void {
    this.criteriaModel.update((value) => ({ ...value, activityPeriodMode }));
  }

  protected selectCalendarPeriodMode(calendarPeriodMode: CalendarReportPeriodMode): void {
    this.criteriaModel.update((value) => ({ ...value, calendarPeriodMode }));
  }

  protected applyCriteria(event: Event): void {
    event.preventDefault();
    void submit(this.criteriaForm, async () => {
      const model = this.criteriaModel();
      const clientStatuses = model.activeClientsOnly ? (['active'] as const) : model.clientStatuses;
      this.appliedCriteria.set({
        cohort: model.cohort,
        period: this.periodFromModel(model),
        callStatuses: [...model.callStatuses],
        clientStatuses: [...clientStatuses],
      });
    });
  }

  protected fieldError(field: typeof this.criteriaForm.activityMonth): string {
    const state = field();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  }

  protected printReport(): void {
    window.print();
  }

  private periodFromModel(model: ReportsCriteriaFormModel): ReportPeriod {
    if (model.cohort === 'activity') {
      if (model.activityPeriodMode === 'all') return { from: null, to: null };
      if (model.activityPeriodMode === 'month') {
        return this.monthBounds(model.activityMonth) ?? { from: null, to: null };
      }
      return { from: model.activityFrom, to: model.activityTo };
    }
    if (model.calendarPeriodMode === 'month') {
      return this.monthBounds(model.calendarMonth) ?? { from: null, to: null };
    }
    return { from: model.calendarFrom, to: model.calendarTo };
  }

  private rangeError(active: boolean, from: string, to: string) {
    if (!active) return undefined;
    if (!to) {
      return { kind: 'required', message: this.i18n.t('reports.validation.rangeRequired') };
    }
    return from && from > to
      ? { kind: 'order', message: this.i18n.t('reports.validation.rangeOrder') }
      : undefined;
  }

  private currentMonthValue(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private monthBounds(value: string): ReportPeriod | null {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      from: `${year}-${String(month).padStart(2, '0')}-01`,
      to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  private formatPeriod(period: ReportPeriod): string {
    if (!period.from || !period.to) return this.i18n.t('reports.period.allTime');
    return `${this.i18n.formatDate(`${period.from}T12:00:00`)} — ${this.i18n.formatDate(`${period.to}T12:00:00`)}`;
  }

  private formatStatusList(labels: readonly string[]): string {
    return labels.length ? labels.join(', ') : this.i18n.t('reports.filters.all');
  }

  private callStatusFilterLabel(status: CallStatusFilterKey): string {
    if (status === 'none') return this.i18n.t('leads.filter.callStatusNone');
    if (status === 'callback_undated') {
      return this.i18n.t('leads.filter.callStatusCallbackUndated');
    }
    return this.i18n.callStatusLabel(status);
  }

  private clientStatusFilterLabel(status: SelectableClientStatusFilterKey | 'active'): string {
    if (status === 'in_work') return this.i18n.t('workflow.taken');
    if (status === 'active') return this.i18n.t('leads.filter.clientStatusActive');
    return this.i18n.clientStatusLabel(status);
  }
}
