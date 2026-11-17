import { Component, computed, inject, input, output, signal } from '@angular/core';

import type { HrEntry } from '@core/api/generated/kolss-api.types';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { V2Button } from '../../v2/ui/v2-button';
import { HrText } from '../hr-text';
import { HrAbsenceChip } from '../ui/hr-absence-chip';

/**
 * Entries list (HR-me.dc.html "My entries"): dates, chip with the part, days, comment, "Added …";
 * Edit / Delete while the entry is editable, else the lock reason ("Past date" / "Month
 * closed"). Make-up entries are shifts: only Delete. Delete asks inline first.
 */
@Component({
  selector: 'app-hr-entries-list',
  imports: [HrAbsenceChip, TranslatePipe, V2Button],
  templateUrl: './hr-entries-list.html',
  styleUrl: './hr-entries-list.scss',
})
export class HrEntriesList {
  protected readonly text = inject(HrText);

  readonly entries = input.required<readonly HrEntry[]>();
  /** Show who added the entry (HR admins see other people's entries). */
  readonly showAuthor = input(false);
  readonly busyId = input<string | null>(null);

  readonly edit = output<HrEntry>();
  readonly remove = output<HrEntry>();

  protected readonly confirmId = signal<string | null>(null);

  protected readonly rows = computed(() =>
    this.entries().map((entry) => ({
      entry,
      dates:
        entry.dateFrom === entry.dateTo
          ? this.text.fullDay(entry.dateFrom)
          : `${this.text.day(entry.dateFrom)} – ${this.text.fullDay(entry.dateTo)}`,
      days: this.text.plural('hr.n.days', entry.days),
      hours:
        entry.startTime && entry.endTime ? this.text.range(entry.startTime, entry.endTime) : '',
      added:
        this.showAuthor() && entry.createdByName
          ? this.text.t('hr.entries.addedBy', {
              date: this.text.dateTime(entry.createdAt),
              name: entry.createdByName,
            })
          : this.text.t('hr.entries.added', { date: this.text.dateTime(entry.createdAt) }),
      lock: entry.lockReason
        ? this.text.t(`hr.entries.lock.${entry.lockReason}` as MessageKey)
        : '',
    })),
  );

  protected confirm(entry: HrEntry): void {
    this.remove.emit(entry);
    this.confirmId.set(null);
  }
}
