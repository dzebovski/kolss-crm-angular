import { Component, computed, inject, resource, signal } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SessionService } from '../../../core/session/session.service';
import { UiButton } from '../../../ui/button/ui-button';
import { UiAlert } from '../../../ui/feedback/ui-alert';
import { UiTextField } from '../../../ui/form/ui-text-field';
import { ManagerReportSection } from './manager-report-section';
import { ReportSummary } from './report-summary';
import { ReportsService } from './reports.service';
import type { ReportPeriod, ReportPeriodMode } from './reports.types';

@Component({
  selector: 'app-reports-page',
  imports: [ManagerReportSection, ReportSummary, TranslatePipe, UiAlert, UiButton, UiTextField],
  template: `
    <section class="reports-page" aria-labelledby="reports-title">
      <header class="page-header screen-only">
        <div>
          <p class="page-kicker">Management print brief</p>
          <h1 id="reports-title">{{ 'reports.title' | translate }}</h1>
          <p>{{ 'reports.subtitle' | translate }}</p>
        </div>
        <app-ui-button
          variant="secondary"
          [disabled]="reportResource.isLoading() || !reportResource.hasValue()"
          (pressed)="printReport()"
        >
          {{ 'reports.print' | translate }}
        </app-ui-button>
      </header>

      <section class="period-console screen-only" aria-labelledby="period-console-title">
        <div class="period-console__intro">
          <span aria-hidden="true">01</span>
          <div>
            <h2 id="period-console-title">{{ 'reports.periodSettings' | translate }}</h2>
            <p>{{ 'reports.periodSettingsHint' | translate }}</p>
          </div>
        </div>

        <div class="period-console__controls">
          <div class="period-modes" role="group" [attr.aria-label]="'reports.period' | translate">
            @for (mode of periodModes; track mode.value) {
              <button
                type="button"
                [class.is-active]="periodMode() === mode.value"
                [attr.aria-pressed]="periodMode() === mode.value"
                (click)="selectPeriodMode(mode.value)"
              >
                {{ mode.label | translate }}
              </button>
            }
          </div>

          @if (periodMode() === 'month') {
            <app-ui-text-field
              type="month"
              name="report-month"
              [label]="'reports.month' | translate"
              [(value)]="selectedMonth"
            />
          }

          @if (periodMode() === 'custom') {
            <div class="custom-dates">
              <app-ui-text-field
                type="date"
                name="report-from"
                [label]="'reports.dateFrom' | translate"
                [(value)]="customFrom"
              />
              <app-ui-text-field
                type="date"
                name="report-to"
                [label]="'reports.dateTo' | translate"
                [(value)]="customTo"
              />
            </div>
          }

          @if (periodMode() !== 'all') {
            <app-ui-button size="small" (pressed)="applyPeriod()">
              {{ 'reports.generate' | translate }}
            </app-ui-button>
          }
        </div>

        @if (periodError()) {
          <p class="period-error" role="alert">{{ periodError() }}</p>
        }
      </section>

      @if (loadError()) {
        <app-ui-alert tone="danger" [title]="'reports.loadError' | translate">
          {{ loadError() }}
        </app-ui-alert>
      }

      @if (reportResource.isLoading() && !reportResource.hasValue()) {
        <div class="report-loading" role="status" aria-live="polite">
          <span aria-hidden="true"></span>
          <strong>{{ 'reports.loading' | translate }}</strong>
          <p>{{ 'reports.loadingHint' | translate }}</p>
        </div>
      } @else if (reportResource.value(); as report) {
        @if (report.totals.total > 0) {
          <app-report-summary [report]="report" [periodLabel]="periodLabel()" />

          <div class="manager-report-stack">
            @for (manager of report.managers; track manager.officeCode + '-' + manager.managerId) {
              <app-manager-report-section [manager]="manager" />
            }
          </div>
        } @else {
          <div class="report-empty" role="status">
            <span aria-hidden="true">0</span>
            <h2>{{ 'reports.emptyTitle' | translate }}</h2>
            <p>{{ 'reports.emptyHint' | translate }}</p>
          </div>
        }
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .reports-page {
      display: grid;
      gap: var(--ui-space-5);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: var(--ui-space-6);
    }

    .page-kicker {
      margin: 0 0 var(--ui-space-2);
      color: var(--ui-action);
      font-size: 0.7rem;
      font-weight: 850;
      letter-spacing: 0.11em;
      text-transform: uppercase;
    }

    h1,
    h2 {
      margin: 0;
      font-family: var(--ui-font-display), sans-serif;
    }

    h1 {
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 0.95;
    }

    .page-header p:not(.page-kicker),
    .period-console__intro p,
    .report-loading p,
    .report-empty p {
      margin: var(--ui-space-2) 0 0;
      color: var(--ui-text-muted);
    }

    .period-console {
      padding: var(--ui-space-4);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      display: grid;
      grid-template-columns: minmax(14rem, 0.7fr) minmax(24rem, 1.3fr);
      gap: var(--ui-space-5);
      align-items: center;
      box-shadow: var(--ui-shadow-1);
    }

    .period-console__intro {
      display: flex;
      align-items: center;
      gap: var(--ui-space-3);
    }

    .period-console__intro > span {
      width: 2.6rem;
      height: 2.6rem;
      border-radius: 50%;
      background: var(--ui-text);
      color: white;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      font-family: var(--ui-font-display), sans-serif;
      font-size: 0.78rem;
      font-weight: 850;
    }

    .period-console__intro h2 {
      font-size: 1rem;
    }

    .period-console__intro p {
      font-size: 0.75rem;
    }

    .period-console__controls {
      display: flex;
      justify-content: flex-end;
      align-items: end;
      gap: var(--ui-space-3);
    }

    .period-modes {
      padding: 0.2rem;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-subtle);
      display: flex;
      gap: 0.15rem;
    }

    .period-modes button {
      min-height: 2rem;
      padding: 0 var(--ui-space-3);
      border: 0;
      border-radius: calc(var(--ui-radius-md) - 0.2rem);
      background: transparent;
      color: var(--ui-text-muted);
      cursor: pointer;
      font-size: 0.76rem;
      font-weight: 750;
      white-space: nowrap;
    }

    .period-modes button.is-active {
      background: var(--ui-text);
      color: white;
      box-shadow: var(--ui-shadow-1);
    }

    .custom-dates {
      display: grid;
      grid-template-columns: repeat(2, minmax(8rem, 1fr));
      gap: var(--ui-space-2);
    }

    .period-error {
      grid-column: 1 / -1;
      margin: calc(-1 * var(--ui-space-2)) 0 0;
      color: var(--ui-danger);
      font-size: 0.78rem;
      font-weight: 650;
      text-align: right;
    }

    .manager-report-stack {
      display: grid;
      gap: var(--ui-space-6);
    }

    .report-loading,
    .report-empty {
      min-height: 22rem;
      padding: var(--ui-space-8);
      border: 1px dashed var(--ui-border-strong);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-subtle);
      display: grid;
      place-content: center;
      justify-items: center;
      text-align: center;
    }

    .report-loading > span {
      width: 2.5rem;
      height: 2.5rem;
      margin-bottom: var(--ui-space-3);
      border: 0.2rem solid var(--ui-border);
      border-top-color: var(--ui-action);
      border-radius: 50%;
      animation: report-spin 0.8s linear infinite;
    }

    .report-empty > span {
      width: 4rem;
      height: 4rem;
      margin-bottom: var(--ui-space-3);
      border-radius: 50%;
      background: var(--ui-text);
      color: white;
      display: grid;
      place-items: center;
      font-family: var(--ui-font-display), sans-serif;
      font-size: 1.5rem;
      font-weight: 850;
    }

    .report-empty h2 {
      font-size: 1.4rem;
    }

    @keyframes report-spin {
      to {
        transform: rotate(1turn);
      }
    }

    @media (max-width: 72rem) {
      .period-console {
        grid-template-columns: 1fr;
      }

      .period-console__controls {
        justify-content: flex-start;
        flex-wrap: wrap;
      }
    }

    @media (max-width: 42rem) {
      .page-header {
        align-items: start;
        flex-direction: column;
      }

      .period-console__controls,
      .period-modes {
        align-items: stretch;
        flex-direction: column;
      }

      .period-modes button {
        text-align: left;
      }

      .custom-dates {
        grid-template-columns: 1fr;
      }
    }

    @media print {
      :host {
        display: block;
      }

      .reports-page {
        display: block;
      }

      .screen-only,
      app-ui-alert,
      .report-loading {
        display: none !important;
      }

      .manager-report-stack {
        display: block;
      }

      .report-empty {
        min-height: 0;
        border: 0;
        background: white;
      }
    }
  `,
})
export class ReportsPage {
  private readonly session = inject(SessionService);
  private readonly reports = inject(ReportsService);
  protected readonly i18n = inject(I18nService);

  protected readonly periodMode = signal<ReportPeriodMode>('all');
  protected readonly selectedMonth = signal(this.currentMonthValue());
  protected readonly customFrom = signal('');
  protected readonly customTo = signal('');
  protected readonly periodError = signal('');
  private readonly appliedPeriod = signal<ReportPeriod>({ from: null, to: null });

  protected readonly periodModes: readonly {
    readonly value: ReportPeriodMode;
    readonly label: 'reports.period.all' | 'reports.period.calendarMonth' | 'reports.period.custom';
  }[] = [
    { value: 'all', label: 'reports.period.all' },
    { value: 'month', label: 'reports.period.calendarMonth' },
    { value: 'custom', label: 'reports.period.custom' },
  ];

  protected readonly reportResource = resource({
    params: () => ({ officeId: this.session.selectedOfficeId(), period: this.appliedPeriod() }),
    loader: ({ params }) => this.reports.load(params.officeId, params.period),
  });

  protected readonly loadError = computed(() => {
    const error = this.reportResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });

  protected readonly periodLabel = computed(() => {
    const period = this.reportResource.value()?.period ?? this.appliedPeriod();
    if (!period.from || !period.to) return this.i18n.t('reports.period.all');
    return `${this.formatPeriodDate(period.from)} — ${this.formatPeriodDate(period.to)}`;
  });

  protected selectPeriodMode(mode: ReportPeriodMode): void {
    this.periodMode.set(mode);
    this.periodError.set('');
    if (mode === 'all') {
      this.appliedPeriod.set({ from: null, to: null });
    }
  }

  protected applyPeriod(): void {
    this.periodError.set('');
    if (this.periodMode() === 'month') {
      const bounds = this.monthBounds(this.selectedMonth());
      if (!bounds) {
        this.periodError.set(this.i18n.t('reports.validation.monthRequired'));
        return;
      }
      this.appliedPeriod.set(bounds);
      return;
    }
    if (this.periodMode() === 'custom') {
      const from = this.customFrom();
      const to = this.customTo();
      if (!from || !to) {
        this.periodError.set(this.i18n.t('reports.validation.rangeRequired'));
        return;
      }
      if (from > to) {
        this.periodError.set(this.i18n.t('reports.validation.rangeOrder'));
        return;
      }
      this.appliedPeriod.set({ from, to });
    }
  }

  protected printReport(): void {
    window.print();
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

  private formatPeriodDate(value: string): string {
    return this.i18n.formatDate(`${value}T12:00:00`);
  }
}
