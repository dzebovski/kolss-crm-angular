import { Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2Money, V2_ESTIMATE_LINES } from '@domain/v2/project-money';
import type { V2ProjectEstimate } from '@domain/v2/project.types';
import { V2Button } from '../../ui/v2-button';
import { V2InfoCard } from '../../ui/v2-info-card';

// Estimate block of the Project card (pipeline 2.1/3): Kitchen, Appliances, Installation,
// Countertop and the total per currency. Read-only once the main contract exists (`locked`).
// Presentational: Edit estimate opens the P5 popup through the page.
@Component({
  selector: 'app-v2-project-estimate-card',
  imports: [TranslatePipe, V2Button, V2InfoCard],
  template: `
    <app-v2-info-card [title]="'v2.projectCard.estimate.title' | translate">
      <button
        v2CardAside
        type="button"
        appV2Button
        size="sm"
        [disabled]="!canEdit()"
        [attr.title]="lockHint() || null"
        (click)="edit.emit()"
      >
        {{ 'v2.projectCard.estimate.edit' | translate }}
      </button>
      <dl class="v2-estimate__lines">
        @for (line of lines(); track line.key) {
          <div class="v2-estimate__line">
            <dt>{{ line.labelKey | translate }}</dt>
            <dd [class.v2-estimate__unset]="!line.amount">
              {{ line.amount ?? '—' }}
              @if (line.note) {
                <span class="v2-estimate__note">{{ line.note }}</span>
              }
            </dd>
          </div>
        }
        <div class="v2-estimate__line v2-estimate__line--total">
          <dt>{{ 'v2.projectCard.estimate.total' | translate }}</dt>
          <dd>{{ total() || '—' }}</dd>
        </div>
      </dl>
      @if (estimate().locked) {
        <p class="v2-estimate__locked">{{ 'v2.projectCard.estimate.locked' | translate }}</p>
      }
    </app-v2-info-card>
  `,
  styles: `
    .v2-estimate__lines {
      display: flex;
      flex-direction: column;
      margin: 0;
    }

    .v2-estimate__line {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--v2-space-4);
      padding: 10px 0;
      border-bottom: 1px solid var(--v2-line-soft);
      font-size: 14px;

      dt {
        color: var(--v2-ink-2);
      }

      dd {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        margin: 0;
        font-weight: 500;
        text-align: right;
      }
    }

    .v2-estimate__line--total {
      border-bottom: 0;
      font-weight: 600;

      dt,
      dd {
        color: var(--v2-ink);
        font-weight: 600;
      }
    }

    .v2-estimate__unset {
      color: var(--v2-subtle);
    }

    .v2-estimate__note {
      color: var(--v2-muted);
      font-size: 12px;
      font-weight: 400;
    }

    .v2-estimate__locked {
      margin: 0;
      color: var(--v2-muted);
      font-size: 12px;
    }
  `,
})
export class V2ProjectEstimateCard {
  private readonly i18n = inject(I18nService);

  readonly estimate = input.required<V2ProjectEstimate>();
  readonly canEdit = input(false);
  /** The read-only hint, also the tooltip of the locked button; empty while the user can act. */
  readonly lockHint = input('');
  readonly edit = output<void>();

  protected readonly lines = computed(() => {
    const locale = this.i18n.locale();
    const { lines } = this.estimate();
    return V2_ESTIMATE_LINES.map((key) => {
      const line = lines[key];
      return {
        key,
        labelKey: `v2.project.estimate.${key}` as MessageKey,
        amount: line ? formatV2Money(line.money, locale) : null,
        note: line?.note ?? null,
      };
    });
  });

  protected readonly total = computed(() =>
    this.estimate()
      .totals.map((money) => formatV2Money(money, this.i18n.locale()))
      .join(' + '),
  );
}
