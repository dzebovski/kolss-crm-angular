import { Component, computed, inject, input, resource, signal } from '@angular/core';

import type { HrEmployeeDetail, HrEntry, HrEntryType } from '@core/api/generated/kolss-api.types';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { addDays, monthEnd, monthOf, monthStart, shiftMonth } from '@domain/hr/hr-dates';
import { HR_ENTRY_TYPES } from '@domain/hr/hr-entry';
import { HrService } from '@services/hr/hr.service';
import { V2Button } from '../../v2/ui/v2-button';
import { V2Select, type V2SelectOption } from '../../v2/ui/v2-select';
import { V2ToastService } from '../../v2/ui/toast/v2-toast';
import { HrDialogs } from '../dialogs/hr-dialogs';
import { HrText } from '../hr-text';
import { HrAbsenceChip } from '../ui/hr-absence-chip';
import { HrTypeIcon } from '../ui/hr-type-icon';

type HrEntriesRange = 'year' | 'month' | 'last12';

// Entries tab (HR-employee-entries.dc.html): type chips, period, and every entry with the
// closed-month tag; the super admin edits and deletes any entry (closed months included).
@Component({
  selector: 'app-hr-employee-entries',
  imports: [HrAbsenceChip, HrTypeIcon, TranslatePipe, V2Button, V2Select],
  templateUrl: './hr-employee-entries.html',
  styleUrl: './hr-employee-tab.scss',
  host: { style: '--hr-cols: 180px 210px 72px minmax(160px, 1fr) 150px 104px' },
  styles: `
    @use '../ui/hr';
    @use '../../../../styles/v2/type';

    .hr-chip {
      @include type.text('label');

      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      border: 1px solid var(--v2-line);
      border-radius: var(--v2-radius-pill);
      background: var(--v2-surface);
      color: var(--v2-ink-2);
      font-weight: 500;
      cursor: pointer;
    }

    .hr-chip--on {
      border-color: var(--v2-ink);
      background: var(--v2-ink);
      color: var(--v2-surface);
    }

    .hr-period {
      width: 180px;
      margin-left: auto;
    }

    .hr-dates {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: flex-start;
    }

    .hr-type {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }

    .hr-actions {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
    }

    .hr-icon-btn {
      @include hr.icon-button;
    }

    .hr-confirm {
      @include hr.note(error);

      grid-column: 1 / -1;
      align-items: center;
      margin-top: 6px;
    }

    .hr-confirm__text {
      flex: 1;
    }
  `,
})
export class HrEmployeeEntries {
  private readonly hr = inject(HrService);
  private readonly dialogs = inject(HrDialogs);
  private readonly toast = inject(V2ToastService);
  protected readonly text = inject(HrText);

  readonly detail = input.required<HrEmployeeDetail>();

  protected readonly types = HR_ENTRY_TYPES;
  protected readonly type = signal<HrEntryType | null>(null);
  protected readonly range = signal<HrEntriesRange>('year');
  protected readonly confirmId = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);

  protected readonly rangeOptions = computed<V2SelectOption[]>(() => [
    { value: 'year', label: this.text.t('hr.entries.year') },
    { value: 'month', label: this.text.t('hr.entries.month') },
    { value: 'last12', label: this.text.t('hr.entries.last12') },
  ]);

  private readonly period = computed(() => {
    const today = this.detail().today;
    const month = monthOf(today);
    switch (this.range()) {
      case 'month':
        return { from: monthStart(month), to: monthEnd(month) };
      case 'last12':
        return { from: monthStart(shiftMonth(month, -11)), to: addDays(today, 366) };
      default:
        return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    }
  });

  private readonly entries = resource({
    params: () => ({
      id: this.detail().employee.id,
      ...this.period(),
      type: this.type() ?? undefined,
      v: this.hr.changes(),
    }),
    loader: ({ params }) =>
      this.hr.entries({
        employeeId: params.id,
        from: params.from,
        to: params.to,
        type: params.type,
      }),
  });

  protected readonly rows = computed(() => {
    const list = this.entries.hasValue() ? [...this.entries.value()] : [];
    return list
      .sort((a, b) => b.dateFrom.localeCompare(a.dateFrom))
      .map((entry) => ({
        entry,
        dates:
          entry.dateFrom === entry.dateTo
            ? this.text.day(entry.dateFrom)
            : `${this.text.day(entry.dateFrom)} – ${this.text.day(entry.dateTo)}`,
        part:
          entry.startTime && entry.endTime
            ? this.text.range(entry.startTime, entry.endTime)
            : this.text.part(entry.part),
        days: this.text.daysShort(entry.days),
        when: this.text.dateTime(entry.createdAt),
        by: entry.createdByName
          ? this.text.t('hr.entries.byName', { name: entry.createdByName })
          : '',
      }));
  });

  protected edit(entry: HrEntry): void {
    this.dialogs.absence({
      employeeId: entry.employeeId,
      entry: {
        id: entry.id,
        kind: entry.kind,
        employeeId: entry.employeeId,
        type: entry.type,
        dateFrom: entry.dateFrom,
        dateTo: entry.dateTo,
        part: entry.part,
        comment: entry.comment,
      },
    });
  }

  protected async remove(entry: HrEntry): Promise<void> {
    this.confirmId.set(null);
    this.busyId.set(entry.id);
    try {
      await this.hr.deleteEntry(entry);
      this.toast.show(this.text.t('hr.toast.deleted'));
    } catch (error) {
      this.toast.show(this.text.saveError(error, { today: this.detail().today }));
    } finally {
      this.busyId.set(null);
    }
  }
}
