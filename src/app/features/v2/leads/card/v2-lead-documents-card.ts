import { Component, computed, inject, input } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { LeadAttachment } from '@domain/lead.types';
import { formatV2CardDate } from '@domain/v2/date-format';
import { V2InfoCard } from '../../ui/v2-info-card';

// Documents card from lead card v1.3. Read-only: there is no upload endpoint yet (roadmap
// "Later"), so Add documents is disabled and files are listed without the Plan tag or a link.
@Component({
  selector: 'app-v2-lead-documents-card',
  imports: [TranslatePipe, V2InfoCard],
  template: `
    <app-v2-info-card class="v2-docs" [title]="'v2.docs.title' | translate">
      @for (file of files(); track file.id) {
        <div class="v2-docs__file">
          <span class="v2-docs__type" aria-hidden="true">{{ file.type }}</span>
          <span class="v2-docs__text">
            <span class="v2-docs__name">{{ file.name }}</span>
            <span class="v2-docs__meta">{{ file.meta }}</span>
          </span>
        </div>
      } @empty {
        <p class="v2-docs__empty">{{ 'v2.docs.empty' | translate }}</p>
      }

      <!-- TODO(v2): document upload has no endpoint yet (roadmap "Later"). -->
      <button type="button" class="v2-docs__add" aria-disabled="true">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        {{ 'v2.docs.add' | translate }}
      </button>
    </app-v2-info-card>
  `,
  styles: `
    :host {
      display: flex;
    }

    .v2-docs {
      flex-grow: 1;
      gap: var(--v2-space-3);
      min-height: 272px;
    }

    // 44px type tile, 11px mono and #55554f are board values without a token.
    .v2-docs__file {
      display: flex;
      align-items: center;
      gap: var(--v2-space-3);
      margin: 0 calc(-1 * var(--v2-space-2));
      padding: var(--v2-space-2);
      border-radius: var(--v2-radius-md);
    }

    .v2-docs__type {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border: 1px solid var(--v2-line);
      border-radius: var(--v2-radius-md);
      color: #55554f;
      font-family: var(--v2-font-mono);
      font-size: 11px;
    }

    .v2-docs__text {
      display: flex;
      flex-grow: 1;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .v2-docs__name {
      overflow: hidden;
      font-size: 14px;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .v2-docs__meta {
      color: var(--v2-muted);
      font-size: 12px;
    }

    .v2-docs__empty {
      margin: 0;
      color: var(--v2-subtle);
      font-size: 14px;
    }

    .v2-docs__add {
      display: inline-flex;
      align-self: flex-start;
      align-items: center;
      gap: 6px;
      height: 36px;
      margin-top: auto;
      padding: 0 var(--v2-space-3);
      border: 1px dashed var(--v2-faint);
      border-radius: var(--v2-radius-sm);
      background: var(--v2-surface);
      color: var(--v2-ink);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      opacity: 0.4;
      cursor: not-allowed;

      svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
      }

      &:focus-visible {
        outline: 2px solid var(--v2-ink);
        outline-offset: 2px;
      }
    }
  `,
})
export class V2LeadDocumentsCard {
  private readonly i18n = inject(I18nService);

  readonly attachments = input.required<readonly LeadAttachment[]>();
  readonly now = input.required<Date>();

  protected readonly files = computed(() =>
    this.attachments().map((file) => ({
      id: file.id,
      name: file.name,
      type: (file.name.split('.').at(-1) ?? '').slice(0, 4).toUpperCase(),
      meta: `${file.sizeLabel} · ${formatV2CardDate(file.addedAt, this.now(), this.i18n.locale())}`,
    })),
  );
}
