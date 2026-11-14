import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2CardDate } from '@domain/v2/date-format';
import { formatV2Money } from '@domain/v2/project-money';
import { v2IsProjectClosed, type V2ProjectActions } from '@domain/v2/project-status';
import type { V2Project } from '@domain/v2/project.types';
import { V2Button } from '../../ui/v2-button';
import { V2CodeChip } from '../../ui/v2-code-chip';
import { V2ProjectStageBar } from './v2-project-stage-bar';

// Header of Project card v4 (owner decisions 2026-11-14; no board, design-system style): client
// name + code, description (the lead's "About the client"), Add comment / Edit client info /
// Close project / Project finished, the contact grid with the preliminary estimate and paid
// totals, and the 6-step tracker. Presentational: the page opens the popups.
@Component({
  selector: 'app-v2-project-header',
  imports: [RouterLink, TranslatePipe, V2Button, V2CodeChip, V2ProjectStageBar],
  templateUrl: './v2-project-header.html',
  styleUrl: './v2-project-header.scss',
})
export class V2ProjectHeader {
  private readonly i18n = inject(I18nService);

  readonly project = input.required<V2Project>();
  /** "Kitchen + wardrobe"; empty until the lead loaded. */
  readonly products = input('');
  readonly now = input.required<Date>();
  readonly actions = input.required<V2ProjectActions>();
  /** The read-only hint, also the tooltip of the locked buttons; empty while the user can act. */
  readonly lockHint = input('');
  /** Edit client info is loading the client. */
  readonly editingClient = input(false);
  readonly finishing = input(false);
  /** A failed Edit client info load or Project finished. */
  readonly error = input('');
  readonly changeStatus = output<void>();
  readonly editClient = output<void>();
  readonly addComment = output<void>();
  readonly cancelProject = output<void>();
  readonly finishProject = output<void>();
  readonly editEstimate = output<void>();
  readonly addPayment = output<void>();

  protected readonly final = computed(() => v2IsProjectClosed(this.project().status));
  protected readonly created = computed(() =>
    formatV2CardDate(this.project().createdAt, this.now(), this.i18n.locale()),
  );
  protected readonly phoneHref = computed(() => {
    const phone = this.project().client.phone;
    return phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null;
  });
  protected readonly estimate = computed(() => {
    const estimate = this.project().estimate;
    return estimate ? formatV2Money(estimate, this.i18n.locale()) : null;
  });
  /** "12 000 zł + 500 €"; null before the first payment. */
  protected readonly paid = computed(() => {
    const locale = this.i18n.locale();
    const totals = this.project().paidTotals.map((money) => formatV2Money(money, locale));
    return totals.length ? totals.join(' + ') : null;
  });
  /** Tooltip of a locked Project finished: the viewer hint, else "only from Installation". */
  protected readonly finishHint = computed(() =>
    this.actions().canFinish ? null : this.lockHint() || this.i18n.t('v2.projectCard.finishHint'),
  );
}
