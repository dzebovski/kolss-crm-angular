import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { OFFICE_CONFIG } from '@core/office/office.config';
import { formatV2CardDate } from '@domain/v2/date-format';
import type { V2Project } from '@domain/v2/project.types';
import type { V2LeadCard } from '@domain/v2/lead-card.types';
import { V2Button } from '../../ui/v2-button';
import { V2CodeChip } from '../../ui/v2-code-chip';
import { V2ProjectStageBar } from './v2-project-stage-bar';

// Header card of the Project card board: eyebrow, client name + code, "created from lead",
// Add comment / Edit client info / Close project, the contact grid (manager and designer) and
// the status bar. Presentational: the page opens the popups (Edit client info edits the shared
// client record, off while the project has no client).
@Component({
  selector: 'app-v2-project-header',
  imports: [RouterLink, TranslatePipe, V2Button, V2CodeChip, V2ProjectStageBar],
  templateUrl: './v2-project-header.html',
  styleUrl: './v2-project-header.scss',
})
export class V2ProjectHeader {
  private readonly i18n = inject(I18nService);

  readonly project = input.required<V2Project>();
  /** The project's lead; null until it loaded (showroom stays empty). */
  readonly lead = input<V2LeadCard | null>(null);
  /** "Kitchen + wardrobe"; empty until the lead loaded. */
  readonly products = input('');
  readonly now = input.required<Date>();
  readonly canChangeStatus = input(false);
  readonly canCancel = input(false);
  readonly canComment = input(false);
  /** The read-only hint, also the tooltip of the locked buttons; empty while the user can act. */
  readonly lockHint = input('');
  /** Edit client info is loading the client. */
  readonly editingClient = input(false);
  /** A failed client load for Edit client info. */
  readonly clientError = input('');
  readonly changeStatus = output<void>();
  readonly editClient = output<void>();
  readonly addComment = output<void>();
  readonly cancelProject = output<void>();

  protected readonly cancelled = computed(() => this.project().status === 'cancelled');
  protected readonly created = computed(() =>
    formatV2CardDate(this.project().createdAt, this.now(), this.i18n.locale()),
  );
  protected readonly showroomKey = computed(() => {
    const office = this.lead()?.officeId;
    return office ? OFFICE_CONFIG[office].showroomCardLabelKey : null;
  });
  protected readonly phoneHref = computed(() => {
    const phone = this.project().client.phone;
    return phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null;
  });
}
