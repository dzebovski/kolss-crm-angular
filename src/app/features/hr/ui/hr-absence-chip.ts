import { Component, computed, inject, input } from '@angular/core';

import type {
  HrCellAbsenceType,
  HrDayPart,
  HrEntryType,
} from '@core/api/generated/kolss-api.types';
import type { MessageKey } from '@core/i18n/messages';
import { HrText } from '../hr-text';
import { HrTypeIcon } from './hr-type-icon';

/** Absence chip (HR-components.dc.html, Absence chip): sm 24 / md 28, `· 1st half` for halves. */
@Component({
  selector: 'app-hr-absence-chip',
  imports: [HrTypeIcon],
  host: {
    '[attr.data-type]': 'type()',
    '[attr.data-size]': 'size()',
  },
  template: `
    <app-hr-type-icon [type]="type()" [size]="size() === 'md' ? 16 : 14" />
    <span class="hr-chip__label">{{ label() }}</span>
    @if (count() !== null) {
      <span class="hr-chip__count">{{ count() }}</span>
    }
  `,
  styleUrl: './hr-absence-chip.scss',
})
export class HrAbsenceChip {
  private readonly text = inject(HrText);

  readonly type = input.required<HrEntryType | HrCellAbsenceType>();
  readonly part = input<HrDayPart>('full_day');
  readonly size = input<'sm' | 'md'>('sm');
  /** Team table: number of days next to the label. */
  readonly count = input<string | null>(null);

  protected readonly label = computed(() => {
    const type = this.text.type(this.type());
    const part = this.part();
    return part === 'full_day'
      ? type
      : `${type} · ${this.text.t(`hr.partTag.${part}` as MessageKey)}`;
  });
}
