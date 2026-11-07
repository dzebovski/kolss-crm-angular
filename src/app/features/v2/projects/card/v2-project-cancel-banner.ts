import { Component, computed, inject, input, output, signal } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2CardDate, formatV2Time } from '@domain/v2/date-format';
import { v2ProjectRestoreStatus } from '@domain/v2/project-card';
import { v2ProjectStatusLabelKey } from '@domain/v2/project-status';
import type { V2ProjectCancelReason, V2ProjectCancellation } from '@domain/v2/project.types';
import { V2Button } from '../../ui/v2-button';

export const V2_CANCEL_REASON_LABEL: Record<V2ProjectCancelReason, MessageKey> = {
  chose_another_supplier: 'v2.projectCard.reason.chose_another_supplier',
  price_too_high: 'v2.projectCard.reason.price_too_high',
  postponed_renovation: 'v2.projectCard.reason.postponed_renovation',
  disagreed_design: 'v2.projectCard.reason.disagreed_design',
  not_relevant: 'v2.projectCard.reason.not_relevant',
  other: 'v2.projectCard.reason.other',
};

// Grey banner of a cancelled project (Project-card-cancelled board): date, who, reasons, comment
// and "Restore project" with its inline "Restore to …?" confirmation. `restore` fires after the
// confirmation; the page performs the restore (P5).
@Component({
  selector: 'app-v2-project-cancel-banner',
  imports: [TranslatePipe, V2Button],
  template: `
    <span class="v2-cancel__icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M5.6 5.6l12.8 12.8" />
      </svg>
    </span>
    <div class="v2-cancel__text">
      <span class="v2-cancel__title">
        @if (cancellation().cancelledByName) {
          {{
            'v2.projectCard.cancelled.title'
              | translate: { date: when(), name: cancellation().cancelledByName }
          }}
        } @else {
          {{ 'v2.projectCard.cancelled.titleNoName' | translate: { date: when() } }}
        }
      </span>
      @if (reasons(); as list) {
        <span class="v2-cancel__reasons">
          {{ 'v2.projectCard.cancelled.reasons' | translate: { reasons: list } }}
        </span>
      }
      @if (cancellation().comment; as comment) {
        <span class="v2-cancel__comment">{{ comment }}</span>
      }
    </div>
    @if (asking()) {
      <div class="v2-cancel__confirm" role="group">
        <span class="v2-cancel__ask">
          {{ 'v2.projectCard.restoreAsk' | translate: { status: restoreLabel() } }}
        </span>
        <button type="button" appV2Button size="sm" (click)="asking.set(false)">
          {{ 'v2.projectCard.keepCancelled' | translate }}
        </button>
        <button type="button" appV2Button size="sm" variant="primary" (click)="confirm()">
          {{ 'v2.projectCard.restoreConfirm' | translate }}
        </button>
      </div>
    } @else {
      <button
        type="button"
        appV2Button
        [disabled]="!canRestore()"
        [attr.title]="lockHint() || null"
        (click)="asking.set(true)"
      >
        {{ 'v2.projectCard.restore' | translate }}
      </button>
    }
  `,
  host: { role: 'status' },
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--v2-space-4);
      padding: var(--v2-space-4) 20px;
      background: var(--v2-surface-sunk);
      border: 1px solid var(--v2-line);
      border-radius: 12px;
    }

    .v2-cancel__icon {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--v2-radius-pill);
      background: var(--v2-surface);
      color: var(--v2-muted);

      svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.75;
        stroke-linecap: round;
      }
    }

    .v2-cancel__text {
      display: flex;
      flex-grow: 1;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
      font-size: 13px;
    }

    .v2-cancel__title {
      font-size: 14px;
      font-weight: 600;
    }

    .v2-cancel__reasons {
      color: var(--v2-ink-2);
    }

    .v2-cancel__comment {
      color: var(--v2-muted);
    }

    .v2-cancel__confirm {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: var(--v2-space-2);
    }

    .v2-cancel__ask {
      font-size: 13px;
      font-weight: 500;
    }
  `,
})
export class V2ProjectCancelBanner {
  private readonly i18n = inject(I18nService);

  readonly cancellation = input.required<V2ProjectCancellation>();
  readonly now = input.required<Date>();
  readonly canRestore = input(false);
  /** Tooltip of the locked Restore button (the read-only hint). */
  readonly lockHint = input('');
  readonly restore = output<void>();

  protected readonly asking = signal(false);

  protected readonly when = computed(() => {
    const at = this.cancellation().cancelledAt;
    return `${formatV2CardDate(at, this.now(), this.i18n.locale())}, ${formatV2Time(at)}`;
  });
  protected readonly reasons = computed(() => {
    const labels = this.cancellation().reasons.map((reason) =>
      this.i18n.t(V2_CANCEL_REASON_LABEL[reason]),
    );
    return labels.length ? labels.join(', ') : null;
  });
  protected readonly restoreLabel = computed(() =>
    this.i18n.t(v2ProjectStatusLabelKey(v2ProjectRestoreStatus(this.cancellation()))),
  );

  protected confirm(): void {
    this.asking.set(false);
    this.restore.emit();
  }
}
