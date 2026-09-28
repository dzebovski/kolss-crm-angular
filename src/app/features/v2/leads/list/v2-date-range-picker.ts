import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2ReportDate } from '@domain/v2/date-format';

export interface V2DateRange {
  readonly from: string;
  readonly to: string;
}

interface CalendarCell {
  readonly key: string;
  readonly day: number | null;
  readonly label: string;
  readonly disabled: boolean;
  readonly edge: boolean;
  readonly inRange: boolean;
  readonly today: boolean;
}

interface CalendarMonth {
  readonly key: string;
  readonly title: string;
  readonly cells: readonly CalendarCell[];
}

@Component({
  selector: 'app-v2-date-range-picker',
  imports: [TranslatePipe],
  template: `
    <section class="v2-range" [attr.aria-label]="'v2.leads.range.title' | translate">
      <header class="v2-range__header">
        <p>{{ hint() }}</p>
        <div class="v2-range__nav">
          <button
            type="button"
            [attr.aria-label]="'v2.leads.range.previous' | translate"
            (click)="previous()"
          >
            ‹
          </button>
          <button
            type="button"
            [attr.aria-label]="'v2.leads.range.next' | translate"
            [disabled]="!canNext()"
            (click)="next()"
          >
            ›
          </button>
        </div>
      </header>

      <div class="v2-range__months">
        @for (month of months(); track month.key) {
          <section class="v2-range__month">
            <h3>{{ month.title }}</h3>
            <div class="v2-range__weekdays" aria-hidden="true">
              @for (day of weekdays(); track $index) {
                <span>{{ day }}</span>
              }
            </div>
            <div class="v2-range__days">
              @for (cell of month.cells; track cell.key) {
                @if (cell.day === null) {
                  <span></span>
                } @else {
                  <button
                    type="button"
                    [disabled]="cell.disabled"
                    [class.v2-range__day--edge]="cell.edge"
                    [class.v2-range__day--between]="cell.inRange"
                    [class.v2-range__day--today]="cell.today"
                    [attr.aria-label]="cell.label"
                    [attr.aria-pressed]="cell.edge"
                    (click)="pick(cell.key)"
                  >
                    {{ cell.day }}
                  </button>
                }
              }
            </div>
          </section>
        }
      </div>

      <footer class="v2-range__footer">
        <div class="v2-range__selection">
          <span>{{ fromText() }}</span
          ><b>–</b
          ><span [class.v2-range__selection--active]="draft().from && !draft().to">{{
            toText()
          }}</span>
        </div>
        <div class="v2-range__actions">
          <button type="button" class="v2-range__cancel" (click)="cancel.emit()">
            {{ 'common.cancel' | translate }}
          </button>
          <button
            type="button"
            class="v2-range__apply"
            [disabled]="!complete()"
            (click)="applyRange()"
          >
            {{ 'v2.leads.range.apply' | translate }}
          </button>
        </div>
      </footer>
    </section>
  `,
  styles: `
    :host {
      position: absolute;
      z-index: 20;
      top: 64px;
      left: 336px;
    }
    .v2-range {
      width: 664px;
      box-sizing: border-box;
      overflow: hidden;
      border: 1px solid var(--v2-line);
      border-radius: var(--v2-radius-lg);
      background: var(--v2-surface);
      box-shadow: 0 16px 40px rgba(23, 23, 26, 0.16);
      color: var(--v2-ink);
    }
    .v2-range__header,
    .v2-range__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 16px;
    }
    .v2-range__header {
      border-bottom: 1px solid var(--v2-line-soft);
    }
    .v2-range__header p {
      margin: 0;
      color: var(--v2-muted);
      font-size: 13px;
    }
    .v2-range__nav,
    .v2-range__actions,
    .v2-range__selection {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .v2-range__nav button {
      width: 32px;
      height: 32px;
      border: 1px solid var(--v2-line);
      border-radius: var(--v2-radius-sm);
      background: var(--v2-surface);
      color: var(--v2-ink);
      font: inherit;
      font-size: 21px;
      cursor: pointer;
    }
    .v2-range__nav button:disabled {
      color: var(--v2-subtle);
      cursor: default;
    }
    .v2-range__months {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      padding: 18px 20px;
    }
    .v2-range__month {
      min-width: 0;
    }
    .v2-range__month h3 {
      margin: 0 0 14px;
      font-size: 14px;
      font-weight: 600;
      text-align: center;
      text-transform: capitalize;
    }
    .v2-range__weekdays,
    .v2-range__days {
      display: grid;
      grid-template-columns: repeat(7, 36px);
      justify-content: center;
    }
    .v2-range__weekdays span {
      height: 24px;
      color: var(--v2-muted);
      font-size: 10px;
      font-weight: 600;
      text-align: center;
    }
    .v2-range__days > span,
    .v2-range__days button {
      width: 36px;
      height: 36px;
      box-sizing: border-box;
    }
    .v2-range__days button {
      border: 0;
      border-radius: var(--v2-radius-sm);
      background: transparent;
      color: var(--v2-ink);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    .v2-range__days button:hover:not(:disabled) {
      background: var(--v2-surface-2);
    }
    .v2-range__days button:disabled {
      color: var(--v2-subtle);
      cursor: default;
    }
    .v2-range__days .v2-range__day--between {
      border-radius: 0;
      background: var(--v2-surface-sunk);
    }
    .v2-range__days .v2-range__day--edge {
      background: var(--v2-ink);
      color: var(--v2-surface);
      font-weight: 600;
    }
    .v2-range__days .v2-range__day--today:not(.v2-range__day--edge) {
      box-shadow: inset 0 0 0 1px var(--v2-ink);
    }
    .v2-range__footer {
      border-top: 1px solid var(--v2-line-soft);
    }
    .v2-range__selection span {
      display: inline-flex;
      min-width: 94px;
      height: 32px;
      box-sizing: border-box;
      align-items: center;
      padding: 0 10px;
      border: 1px solid var(--v2-line);
      border-radius: var(--v2-radius-sm);
      color: var(--v2-muted);
      font-size: 12px;
    }
    .v2-range__selection span:first-child,
    .v2-range__selection .v2-range__selection--active {
      color: var(--v2-ink);
    }
    .v2-range__selection b {
      color: var(--v2-muted);
      font-weight: 400;
    }
    .v2-range__actions button {
      height: 34px;
      padding: 0 14px;
      border-radius: var(--v2-radius-sm);
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .v2-range__cancel {
      border: 1px solid var(--v2-line);
      background: var(--v2-surface);
      color: var(--v2-ink);
    }
    .v2-range__apply {
      border: 1px solid var(--v2-ink);
      background: var(--v2-ink);
      color: var(--v2-surface);
    }
    .v2-range__apply:disabled {
      border-color: var(--v2-line);
      background: var(--v2-surface-sunk);
      color: var(--v2-subtle);
      cursor: default;
    }
    @media (max-width: 900px) {
      :host {
        right: 0;
        left: 0;
      }
      .v2-range {
        width: 100%;
      }
      .v2-range__months {
        grid-template-columns: 1fr;
      }
      .v2-range__month:first-child {
        display: none;
      }
    }
  `,
})
export class V2DateRangePicker {
  private readonly i18n = inject(I18nService);
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  readonly today = input.required<Date>();
  readonly apply = output<V2DateRange>();
  readonly cancel = output<void>();

  protected readonly draft = linkedSignal<
    { from: string; to: string },
    { from: string; to: string }
  >({
    source: () => ({ from: this.from(), to: this.to() }),
    computation: (range) => ({ ...range }),
  });
  private readonly monthOffset = linkedSignal<Date, number>({
    source: () => this.today(),
    computation: () => 0,
  });
  protected readonly complete = computed(() => Boolean(this.draft().from && this.draft().to));
  protected readonly canNext = computed(() => this.monthOffset() < 0);
  protected readonly weekdays = computed(() => {
    const formatter = new Intl.DateTimeFormat(this.i18n.locale(), { weekday: 'short' });
    const monday = new Date(2026, 0, 5);
    return Array.from({ length: 7 }, (_, index) =>
      formatter
        .format(new Date(2026, 0, monday.getDate() + index))
        .slice(0, 2)
        .toUpperCase(),
    );
  });
  protected readonly months = computed<readonly CalendarMonth[]>(() => {
    this.i18n.locale();
    const current = new Date(this.today().getFullYear(), this.today().getMonth(), 1);
    const left = new Date(current.getFullYear(), current.getMonth() - 1 + this.monthOffset(), 1);
    return [left, new Date(left.getFullYear(), left.getMonth() + 1, 1)].map((month) =>
      this.calendarMonth(month),
    );
  });
  protected readonly hint = computed(() =>
    this.i18n.t(
      !this.draft().from
        ? 'v2.leads.range.pickFirst'
        : !this.draft().to
          ? 'v2.leads.range.pickLast'
          : 'v2.leads.range.selected',
    ),
  );
  protected readonly fromText = computed(() =>
    this.draft().from
      ? formatV2ReportDate(localDate(this.draft().from))
      : this.i18n.t('v2.leads.range.start'),
  );
  protected readonly toText = computed(() =>
    this.draft().to
      ? formatV2ReportDate(localDate(this.draft().to))
      : this.i18n.t('v2.leads.range.end'),
  );

  protected previous(): void {
    this.monthOffset.update((offset) => offset - 1);
  }

  protected next(): void {
    if (this.canNext()) this.monthOffset.update((offset) => offset + 1);
  }

  protected pick(date: string): void {
    this.draft.update((range) => {
      if (!range.from || range.to) return { from: date, to: '' };
      return date < range.from ? { from: date, to: range.from } : { from: range.from, to: date };
    });
  }

  protected applyRange(): void {
    const range = this.draft();
    if (range.from && range.to) this.apply.emit(range);
  }

  private calendarMonth(month: Date): CalendarMonth {
    const locale = this.i18n.locale();
    const title = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month);
    const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: CalendarCell[] = Array.from({ length: firstWeekday }, (_, index) => ({
      key: `blank-${index}`,
      day: null,
      label: '',
      disabled: true,
      edge: false,
      inRange: false,
      today: false,
    }));
    const range = this.draft();
    const today = isoDate(this.today());
    for (let day = 1; day <= days; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const key = isoDate(date);
      cells.push({
        key,
        day,
        label: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date),
        disabled: key > today,
        edge: key === range.from || key === range.to,
        inRange: Boolean(range.from && range.to && key > range.from && key < range.to),
        today: key === today,
      });
    }
    return { key: isoDate(month).slice(0, 7), title, cells };
  }
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
