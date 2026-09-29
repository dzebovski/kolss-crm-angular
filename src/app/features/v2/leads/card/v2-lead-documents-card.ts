import { Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { LeadDocument } from '@core/api/generated/kolss-api.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2CardDate } from '@domain/v2/date-format';
import { v2DocumentExtension, v2FormatFileSize } from '@domain/v2/lead-documents';
import type { V2LeadCard } from '@domain/v2/lead-card.types';
import { V2LeadDocumentsService } from '@services/v2/v2-lead-documents.service';
import { V2DialogService } from '../../ui/dialog/v2-dialog.service';
import { V2InfoCard } from '../../ui/v2-info-card';
import { V2AddDocumentsDialog, type V2AddDocumentsData } from './v2-add-documents-dialog';

const DOCUMENT_TAG_LABEL: Record<NonNullable<LeadDocument['tag']>, MessageKey> = {
  plan: 'v2.documents.tag.plan',
  photo: 'v2.documents.tag.photo',
  drawing: 'v2.documents.tag.drawing',
  estimate: 'v2.documents.tag.estimate',
  other: 'v2.documents.tag.other',
};

@Component({
  selector: 'app-v2-lead-documents-card',
  imports: [TranslatePipe, V2InfoCard],
  template: `
    <app-v2-info-card class="v2-docs" [title]="'v2.docs.title' | translate">
      @if (documentsResource.isLoading()) {
        <p class="v2-docs__empty">{{ 'common.loading' | translate }}</p>
      } @else {
        @for (file of files(); track file.document.id) {
          <button type="button" class="v2-docs__file" (click)="download(file.document)">
            <span class="v2-docs__type" aria-hidden="true">{{ file.type }}</span>
            <span class="v2-docs__text">
              <span class="v2-docs__name">{{ file.document.fileName }}</span>
              <span class="v2-docs__meta">{{ file.meta }}</span>
            </span>
            @if (file.document.tag; as tag) {
              <span class="v2-docs__tag">{{ tagLabels[tag] | translate }}</span>
            }
          </button>
        } @empty {
          <p class="v2-docs__empty">{{ 'v2.docs.empty' | translate }}</p>
        }
      }

      @if (error(); as message) {
        <p class="v2-docs__error" role="alert">{{ message }}</p>
      }
      @if (loadError(); as message) {
        <p class="v2-docs__error" role="alert">{{ message }}</p>
      }
      @if (canAdd()) {
        <button type="button" class="v2-docs__add" (click)="addDocuments()">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          {{ 'v2.docs.add' | translate }}
        </button>
      }
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
    .v2-docs__file {
      display: flex;
      width: 100%;
      align-items: center;
      gap: var(--v2-space-3);
      margin: 0 calc(-1 * var(--v2-space-2));
      padding: var(--v2-space-2);
      border: 0;
      border-radius: var(--v2-radius-md);
      background: transparent;
      color: var(--v2-ink);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .v2-docs__file:hover {
      background: var(--v2-surface-2);
    }
    .v2-docs__type {
      display: flex;
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      align-items: center;
      justify-content: center;
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
    .v2-docs__tag {
      padding: 3px 7px;
      border: 1px solid var(--v2-line);
      border-radius: 999px;
      color: var(--v2-muted);
      font-size: 10px;
    }
    .v2-docs__empty {
      margin: 0;
      color: var(--v2-subtle);
      font-size: 14px;
    }
    .v2-docs__error {
      margin: 0;
      color: var(--v2-danger);
      font-size: 12px;
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
      cursor: pointer;
    }
    .v2-docs__add svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }
  `,
})
export class V2LeadDocumentsCard {
  private readonly i18n = inject(I18nService);
  private readonly service = inject(V2LeadDocumentsService);
  private readonly dialogs = inject(V2DialogService);

  readonly lead = input.required<V2LeadCard>();
  readonly now = input.required<Date>();
  /** The API lets only users who can edit the lead attach documents. */
  readonly canAdd = input(false);
  /** Documents were added; the page reloads the lead so the timeline shows the new entry. */
  readonly changed = output<void>();
  protected readonly error = signal('');
  protected readonly tagLabels = DOCUMENT_TAG_LABEL;
  protected readonly documentsResource = resource({
    // A fresh object per loaded lead: other popups attach files too, and the id alone stays equal.
    params: () => ({ id: this.lead().id, loaded: this.lead() }),
    loader: ({ params }) => this.service.list(params.id),
  });
  protected readonly loadError = computed(() => {
    const error = this.documentsResource.error();
    return error
      ? this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed')
      : '';
  });
  protected readonly files = computed(() =>
    (this.documentsResource.value() ?? []).map((document) => ({
      document,
      type: v2DocumentExtension(document.fileName).slice(0, 4).toUpperCase(),
      meta: `${v2FormatFileSize(document.sizeBytes)} · ${document.uploadedByName} · ${formatV2CardDate(document.createdAt, this.now(), this.i18n.locale())}`,
    })),
  );

  protected async addDocuments(): Promise<void> {
    const ref = this.dialogs.open<boolean, V2AddDocumentsData>(V2AddDocumentsDialog, {
      leadId: this.lead().id,
      leadContext: this.lead(),
    });
    if (await firstValueFrom(ref.closed)) this.changed.emit();
  }

  protected async download(document: LeadDocument): Promise<void> {
    this.error.set('');
    try {
      await this.service.download(document.id);
    } catch (error) {
      this.error.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    }
  }
}
