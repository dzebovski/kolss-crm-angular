import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2ClientListItem } from '@domain/v2/client.types';
import { formatV2CardDate } from '@domain/v2/date-format';
import { v2Initials } from '@domain/v2/lead-list.rules';
import { v2PluralCategory } from '@domain/v2/plural';
import { V2Button } from '../../ui/v2-button';
import { V2CodeChip } from '../../ui/v2-code-chip';

interface Row {
  readonly client: V2ClientListItem;
  readonly created: string;
  readonly initials: string;
  readonly leadsWord: string;
  readonly projectsWord: string;
}

// Clients table from the "KOLSS CRM v2" canvas (Clients-list.dc.html): Created / Client / Leads /
// Projects / Manager, the whole row opens the client card, then the "Show N more" footer. The page
// projects the empty and error states. Presentational.
@Component({
  selector: 'app-v2-clients-table',
  imports: [RouterLink, TranslatePipe, V2Button, V2CodeChip],
  templateUrl: './v2-clients-table.html',
  styleUrl: './v2-clients-table.scss',
})
export class V2ClientsTable {
  private readonly i18n = inject(I18nService);

  readonly clients = input.required<readonly V2ClientListItem[]>();
  readonly now = input.required<Date>();
  /** First load: skeleton rows instead of the list. */
  readonly busy = input(false);
  readonly total = input(0);
  readonly hasMore = input(false);
  readonly loadingMore = input(false);
  readonly moreError = input('');

  readonly showMore = output<void>();

  protected readonly skeletonRows = [60, 45, 70, 50, 65, 40, 55, 60];
  protected readonly moreSkeleton = [1, 2, 3];

  protected readonly rows = computed<readonly Row[]>(() => {
    const locale = this.i18n.locale();
    const now = this.now();
    return this.clients().map((client) => ({
      client,
      created: formatV2CardDate(client.createdAt, now, locale),
      initials: v2Initials(client.name),
      leadsWord: this.i18n.t(`v2.clients.leads.${v2PluralCategory(locale, client.leadsCount)}`),
      projectsWord: this.i18n.t(
        `v2.clients.projects.${v2PluralCategory(locale, client.projectsCount)}`,
      ),
    }));
  });

  protected readonly allShown = computed(
    () => !this.hasMore() && !this.busy() && this.total() > 30 && this.clients().length > 0,
  );
  protected readonly nextBatch = computed(() =>
    Math.min(30, Math.max(0, this.total() - this.clients().length)),
  );
}
