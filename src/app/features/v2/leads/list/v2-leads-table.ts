import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { OFFICE_CONFIG } from '@core/office/office.config';
import {
  formatV2CardDate,
  formatV2MonthYear,
  formatV2RelativeTime,
  formatV2Time,
} from '@domain/v2/date-format';
import { groupV2LeadsByMonth, v2Initials } from '@domain/v2/lead-list.rules';
import type { V2LeadListItem } from '@domain/v2/lead-view.types';
import { v2PluralCategory } from '@domain/v2/plural';
import { V2CodeChip } from '../../ui/v2-code-chip';
import { V2RatingPill } from '../../ui/v2-rating-pill';
import { V2StatusPill } from '../../ui/v2-status-pill';
import { readV2CollapsedMonths, writeV2CollapsedMonths } from './v2-leads-collapsed.storage';

interface Row {
  readonly lead: V2LeadListItem;
  readonly date: string;
  readonly time: string;
  readonly commentAge: string;
  readonly managerInitials: string;
  readonly officeKey: MessageKey;
}

interface Group {
  readonly key: string;
  readonly label: string;
  readonly countLabel: string;
  readonly open: boolean;
  readonly rows: readonly Row[];
}

// Leads table from the "KOLSS CRM v2" canvas (Main.dc.html, Table): column header, month
// groups (collapsible, newest first) and lead rows. The name opens the v2 lead card.
@Component({
  selector: 'app-v2-leads-table',
  imports: [RouterLink, TranslatePipe, V2CodeChip, V2RatingPill, V2StatusPill],
  templateUrl: './v2-leads-table.html',
  styleUrl: './v2-leads-table.scss',
})
export class V2LeadsTable {
  private readonly i18n = inject(I18nService);

  readonly leads = input.required<readonly V2LeadListItem[]>();
  readonly now = input.required<Date>();
  /** Marks the list busy while the leads load; the state message is projected. */
  readonly busy = input(false);

  /** Skeleton rows while loading; varied widths (% of the column) read as text. */
  protected readonly skeletonRows = [
    { name: 60, comment: 85 },
    { name: 45, comment: 70 },
    { name: 70, comment: 90 },
    { name: 50, comment: 60 },
    { name: 65, comment: 80 },
    { name: 40, comment: 75 },
    { name: 55, comment: 65 },
    { name: 60, comment: 85 },
  ];

  private readonly collapsed = signal(readV2CollapsedMonths());

  protected readonly groups = computed<readonly Group[]>(() => {
    const locale = this.i18n.locale();
    const now = this.now();
    const collapsed = this.collapsed();
    return groupV2LeadsByMonth(this.leads()).map((group) => ({
      key: group.key,
      label: formatV2MonthYear(group.month, locale),
      open: !collapsed.has(group.key),
      countLabel: this.i18n.t(`v2.leads.count.${v2PluralCategory(locale, group.items.length)}`, {
        count: group.items.length,
      }),
      rows: group.items.map((lead) => ({
        lead,
        date: formatV2CardDate(lead.createdAt, now, locale),
        time: formatV2Time(lead.createdAt),
        commentAge: lead.lastComment ? formatV2RelativeTime(lead.lastComment.at, now, locale) : '',
        managerInitials: lead.managerName ? v2Initials(lead.managerName) : '',
        officeKey: OFFICE_CONFIG[lead.officeId].nameKey,
      })),
    }));
  });

  protected toggle(key: string): void {
    const next = new Set(this.collapsed());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.collapsed.set(next);
    writeV2CollapsedMonths(next);
  }
}
