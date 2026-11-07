import { Component, input, model, signal } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { v2FormatFileSize } from '@domain/v2/lead-documents';
import { v2ProjectFileError } from '@domain/v2/project-files';

// One optional file of a project popup (contract PDF or payment receipt): "Attach file" or the
// chosen file with Remove; a wrong type or size is refused right away with the error under it.
// The popup uploads `file` on save. `current` names the file already stored (edit mode).
@Component({
  selector: 'app-v2-project-file-field',
  imports: [TranslatePipe],
  template: `
    <div class="v2-file-field">
      @if (file(); as chosen) {
        <span class="v2-file-field__file">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
            <path d="M14 3v5h5" />
          </svg>
          <span class="v2-file-field__name">{{ chosen.name }}</span>
          <span class="v2-file-field__size">{{ size(chosen.size) }}</span>
        </span>
        <button
          type="button"
          class="v2-file-field__action"
          [disabled]="disabled()"
          (click)="file.set(null)"
        >
          {{ 'v2.documents.remove' | translate }}
        </button>
      } @else {
        @if (current()) {
          <span class="v2-file-field__current">{{ current() }}</span>
        }
        <button
          type="button"
          class="v2-file-field__action"
          [disabled]="disabled()"
          (click)="picker.click()"
        >
          {{
            (current() ? 'v2.projectPopup.replaceFile' : 'v2.projectPopup.attachFile') | translate
          }}
        </button>
      }
      <input
        #picker
        class="v2-file-field__input"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.heic"
        [disabled]="disabled()"
        (change)="choose($event)"
      />
    </div>
    @if (error(); as key) {
      <p class="v2-file-field__error" role="alert">{{ key | translate }}</p>
    }
  `,
  styles: `
    @use '../../../../../styles/v2/interactive';

    :host {
      display: flex;
      flex-direction: column;
      gap: var(--v2-space-1);
    }

    .v2-file-field {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--v2-space-2) var(--v2-space-3);
      min-height: var(--v2-control-md);
      padding: var(--v2-space-2) var(--v2-space-3);
      border: 1px dashed var(--v2-line-strong);
      border-radius: var(--v2-radius-sm);
      font-size: 13px;
    }

    .v2-file-field__file {
      display: inline-flex;
      align-items: center;
      gap: var(--v2-space-2);
      min-width: 0;

      svg {
        flex-shrink: 0;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
      }
    }

    .v2-file-field__name {
      overflow: hidden;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .v2-file-field__size,
    .v2-file-field__current {
      color: var(--v2-muted);
    }

    .v2-file-field__action {
      margin-left: auto;
      padding: 0 var(--v2-space-2);
      height: var(--v2-control-sm);
      background: transparent;
      border: 0;
      border-radius: var(--v2-radius-xs);
      color: var(--v2-ink);
      font: inherit;
      font-weight: 500;
      cursor: pointer;

      @include interactive.states(ghost);
    }

    .v2-file-field__input {
      display: none;
    }

    .v2-file-field__error {
      margin: 0;
      color: var(--v2-danger);
      font-size: 12px;
    }
  `,
})
export class V2ProjectFileField {
  readonly file = model<File | null>(null);
  /** Name of the file already attached (edit mode); null when there is none. */
  readonly current = input<string | null>(null);
  readonly disabled = input(false);

  protected readonly size = v2FormatFileSize;
  protected readonly error = signal<'' | 'v2.projectPopup.fileType' | 'v2.projectPopup.fileSize'>(
    '',
  );

  protected choose(event: Event): void {
    const picker = event.target as HTMLInputElement;
    const chosen = picker.files?.[0] ?? null;
    picker.value = '';
    if (!chosen) return;
    const problem = v2ProjectFileError(chosen);
    this.error.set(
      problem === 'type' ? 'v2.projectPopup.fileType' : problem ? 'v2.projectPopup.fileSize' : '',
    );
    if (!problem) this.file.set(chosen);
  }
}
