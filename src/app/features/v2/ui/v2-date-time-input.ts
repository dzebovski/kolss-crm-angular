import { Component, computed, inject, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { LocaleCode } from '@domain/i18n.types';
import { formatV2CardDate, formatV2Time } from '@domain/v2/date-format';
import { v2QuickDateChips, type V2QuickDateChipKey } from '@domain/v2/date-chips';
import { V2_NOW } from '../core/v2-clock';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toIsoTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

interface Chip {
  readonly key: V2QuickDateChipKey;
  readonly date: string;
  readonly time: string;
  readonly label: string;
  readonly on: boolean;
}

// Date + time with quick chips (Popup-rules.dc.html spec: "date+time with quick chips (In 2
// hours · Tomorrow 10:00 · next Mon 10:00 · In a week) and past-time error"; exact source
// Create-lead.dc.html script `QUICK`/`dayLabel`). `value` is the same `YYYY-MM-DDTHH:mm`
// (`datetime-local`) text the existing popups already read through
// `v2LocalDateTimeToIso`/`v2IsoToLocalDateTime` (`@domain/v2/lead-action`), so this control is
// a drop-in replacement for the raw `<input type="datetime-local">` those dialogs use today.
// The past-time check itself (`v2IsPastDateTime`) is a `validate()` rule on the consumer's
// field, not built into the control — see the G3 report for why.
@Component({
  selector: 'app-v2-date-time-input',
  imports: [TranslatePipe],
  template: `
    <div class="v2-date-time-input__row">
      <input
        class="v2-date-time-input__field"
        type="date"
        [value]="datePart()"
        (input)="onDateInput($event)"
        (blur)="touch.emit()"
      />
      <input
        class="v2-date-time-input__field v2-date-time-input__field--time"
        type="time"
        [attr.aria-label]="'v2.form.date.timeLabel' | translate"
        [value]="timePart()"
        (input)="onTimeInput($event)"
        (blur)="touch.emit()"
      />
    </div>
    <div class="v2-date-time-input__chips">
      @for (chip of chips(); track chip.key) {
        <button
          type="button"
          class="v2-date-time-input__chip"
          [class.v2-date-time-input__chip--on]="chip.on"
          [attr.aria-pressed]="chip.on"
          (click)="pick(chip)"
        >
          {{ chip.label }}
        </button>
      }
    </div>
  `,
  styles: `
    @use '../../../../styles/v2/chip';

    .v2-date-time-input__row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 112px;
      gap: var(--v2-space-2);
    }

    .v2-date-time-input__field {
      width: 100%;
      height: var(--v2-control-md);
      box-sizing: border-box;
      padding: 0 var(--v2-space-3);
      background: var(--v2-surface);
      border: 1px solid var(--v2-line-strong);
      border-radius: var(--v2-radius-sm);
      color: var(--v2-ink);
      font: inherit;
      font-size: 14px;

      &:hover:not(:disabled) {
        border-color: var(--v2-line-hover);
      }

      &:focus {
        border-color: var(--v2-ink);
        outline: 2px solid var(--v2-ink);
        outline-offset: -1px;
      }
    }

    .v2-date-time-input__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--v2-space-2);
      margin-top: var(--v2-space-2);
    }

    .v2-date-time-input__chip {
      @include chip.base;
    }

    .v2-date-time-input__chip--on {
      @include chip.on;
    }
  `,
})
export class V2DateTimeInput implements FormValueControl<string> {
  readonly value = model('');
  readonly touch = output<void>();

  private readonly now = inject(V2_NOW);
  private readonly i18n = inject(I18nService);

  protected readonly datePart = computed(() => this.value().split('T')[0] ?? '');
  protected readonly timePart = computed(() => this.value().split('T')[1] ?? '');

  protected readonly chips = computed<readonly Chip[]>(() => {
    const now = this.now();
    const locale = this.i18n.locale();
    const current = this.value();
    return v2QuickDateChips(now).map(({ key, at }) => {
      const date = toIsoDate(at);
      const time = toIsoTime(at);
      return {
        key,
        date,
        time,
        label: this.chipLabel(key, at, now, locale),
        on: current === `${date}T${time}`,
      };
    });
  });

  private chipLabel(key: V2QuickDateChipKey, at: Date, now: Date, locale: LocaleCode): string {
    const time = formatV2Time(at);
    switch (key) {
      case 'in2h':
        return this.i18n.t('v2.form.date.chip.in2h');
      case 'inWeek':
        return this.i18n.t('v2.form.date.chip.inWeek');
      case 'tomorrow':
        return `${this.i18n.t('v2.form.date.chip.tomorrow')}, ${time}`;
      case 'nextMonday':
        return `${formatV2CardDate(at, now, locale)}, ${time}`;
    }
  }

  protected pick(chip: Chip): void {
    this.value.set(`${chip.date}T${chip.time}`);
    this.touch.emit();
  }

  protected onDateInput(event: Event): void {
    const date = (event.target as HTMLInputElement).value;
    this.value.set(date ? `${date}T${this.timePart()}` : '');
  }

  protected onTimeInput(event: Event): void {
    const time = (event.target as HTMLInputElement).value;
    this.value.set(this.datePart() ? `${this.datePart()}T${time}` : '');
  }
}
