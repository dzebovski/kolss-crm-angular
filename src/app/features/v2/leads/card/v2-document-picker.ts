import { Component, computed, input, model } from '@angular/core';

import type { LeadDocumentTag } from '@core/api/generated/kolss-api.types';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import {
  v2DocumentExtension,
  v2FormatFileSize,
  v2PendingDocument,
  type V2PendingDocument,
} from '@domain/v2/lead-documents';

const TAGS: readonly LeadDocumentTag[] = ['plan', 'photo', 'drawing', 'estimate', 'other'];
const TAG_LABELS: Record<LeadDocumentTag, MessageKey> = {
  plan: 'v2.documents.tag.plan',
  photo: 'v2.documents.tag.photo',
  drawing: 'v2.documents.tag.drawing',
  estimate: 'v2.documents.tag.estimate',
  other: 'v2.documents.tag.other',
};

@Component({
  selector: 'app-v2-document-picker',
  imports: [TranslatePipe],
  template: `
    <button
      type="button"
      class="v2-picker__dropzone"
      [disabled]="disabled()"
      (click)="fileInput.click()"
      (dragover)="allowDrop($event)"
      (drop)="drop($event)"
    >
      <strong>{{ 'v2.leadInfo.documentsDrop' | translate }}</strong>
      <span>{{ 'v2.leadInfo.documentsHint' | translate }}</span>
    </button>
    <input
      #fileInput
      class="v2-picker__input"
      type="file"
      multiple
      accept=".pdf,.jpg,.jpeg,.png,.heic,.dwg"
      [disabled]="disabled()"
      (change)="choose($event)"
    />

    @for (document of documents(); track document.id) {
      <article class="v2-picker__file" [class.v2-picker__file--error]="document.state === 'error'">
        <span class="v2-picker__type" aria-hidden="true">{{ extension(document.file.name) }}</span>
        <div class="v2-picker__details">
          <div class="v2-picker__heading">
            <strong>{{ document.file.name }}</strong>
            <button
              type="button"
              [disabled]="
                disabled() || document.state === 'uploading' || document.state === 'uploaded'
              "
              [attr.aria-label]="'v2.documents.remove' | translate"
              (click)="remove(document.id)"
            >
              ×
            </button>
          </div>
          <small>{{ fileSize(document.file.size) }}</small>
          @if (document.state === 'uploading') {
            <div
              class="v2-picker__progress"
              role="progressbar"
              [attr.aria-valuenow]="document.progress"
            >
              <span [style.width.%]="document.progress"></span>
            </div>
          } @else if (document.state === 'error') {
            <p role="alert">{{ errorKey(document) | translate }}</p>
          } @else if (document.state === 'uploaded') {
            <p class="v2-picker__done">{{ 'v2.documents.uploaded' | translate }}</p>
          } @else {
            <div class="v2-picker__tags" [attr.aria-label]="'v2.documents.fileType' | translate">
              @for (tag of tags; track tag) {
                <button
                  type="button"
                  [class.v2-picker__tag--on]="document.tag === tag"
                  [attr.aria-pressed]="document.tag === tag"
                  [disabled]="disabled()"
                  (click)="setTag(document.id, tag)"
                >
                  {{ tagLabels[tag] | translate }}
                </button>
              }
            </div>
          }
        </div>
      </article>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--v2-space-2);
    }
    .v2-picker__dropzone {
      display: flex;
      min-height: 112px;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 6px;
      border: 1px dashed var(--v2-line-strong);
      border-radius: var(--v2-radius-md);
      background: var(--v2-surface-2);
      color: var(--v2-ink);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    .v2-picker__dropzone span {
      color: var(--v2-muted);
      font-size: 12px;
    }
    .v2-picker__dropzone:disabled {
      opacity: 0.55;
      cursor: wait;
    }
    .v2-picker__input {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
    .v2-picker__file {
      display: flex;
      gap: var(--v2-space-3);
      padding: var(--v2-space-2);
      border: 1px solid var(--v2-line);
      border-radius: var(--v2-radius-md);
    }
    .v2-picker__file--error {
      border-color: var(--v2-danger);
      background: var(--v2-danger-bg);
    }
    .v2-picker__type {
      display: flex;
      flex: 0 0 44px;
      height: 44px;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--v2-line);
      border-radius: var(--v2-radius-md);
      color: var(--v2-muted);
      font-family: var(--v2-font-mono);
      font-size: 11px;
    }
    .v2-picker__details {
      display: grid;
      flex: 1;
      gap: 5px;
      min-width: 0;
    }
    .v2-picker__heading {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .v2-picker__heading strong {
      overflow: hidden;
      flex: 1;
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .v2-picker__heading button {
      border: 0;
      background: transparent;
      color: var(--v2-muted);
      font: inherit;
      font-size: 19px;
      cursor: pointer;
    }
    .v2-picker__details small {
      color: var(--v2-muted);
      font-size: 11px;
    }
    .v2-picker__details p {
      margin: 0;
      color: var(--v2-danger);
      font-size: 11px;
    }
    .v2-picker__details .v2-picker__done {
      color: var(--v2-positive);
    }
    .v2-picker__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .v2-picker__tags button {
      padding: 3px 8px;
      border: 1px solid var(--v2-line);
      border-radius: 999px;
      background: var(--v2-surface);
      color: var(--v2-muted);
      font: inherit;
      font-size: 10px;
      cursor: pointer;
    }
    .v2-picker__tags .v2-picker__tag--on {
      border-color: var(--v2-ink);
      background: var(--v2-ink);
      color: var(--v2-surface);
    }
    .v2-picker__progress {
      height: 4px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--v2-line);
    }
    .v2-picker__progress span {
      display: block;
      height: 100%;
      background: var(--v2-ink);
      transition: width 0.15s ease;
    }
  `,
})
export class V2DocumentPicker {
  readonly documents = model.required<readonly V2PendingDocument[]>();
  readonly disabled = input(false);
  protected readonly tags = TAGS;
  protected readonly tagLabels = TAG_LABELS;
  protected readonly extension = (name: string) =>
    v2DocumentExtension(name).slice(0, 4).toUpperCase();
  protected readonly fileSize = v2FormatFileSize;
  readonly readyCount = computed(
    () => this.documents().filter((document) => document.state === 'ready').length,
  );

  protected choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.add(input.files);
    input.value = '';
  }

  protected allowDrop(event: DragEvent): void {
    if (!this.disabled()) event.preventDefault();
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) this.add(event.dataTransfer?.files ?? null);
  }

  protected remove(id: string): void {
    this.documents.update((items) => items.filter((document) => document.id !== id));
  }

  protected setTag(id: string, tag: LeadDocumentTag): void {
    this.documents.update((items) =>
      items.map((document) => (document.id === id ? { ...document, tag } : document)),
    );
  }

  protected errorKey(document: V2PendingDocument): MessageKey {
    if (document.error === 'size') return 'v2.documents.error.size';
    if (document.error === 'type') return 'v2.documents.error.type';
    return 'v2.documents.uploadFailed';
  }

  private add(files: FileList | null): void {
    if (!files?.length) return;
    this.documents.update((items) => [...items, ...Array.from(files, v2PendingDocument)]);
  }
}
