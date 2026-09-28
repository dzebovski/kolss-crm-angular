import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2PendingDocument } from '@domain/v2/lead-documents';
import { V2LeadDocumentsService } from '@services/v2/v2-lead-documents.service';
import { V2DialogShell, type V2DialogLeadContext } from '../../ui/dialog/v2-dialog-shell';
import { V2DocumentPicker } from './v2-document-picker';

export interface V2AddDocumentsData {
  readonly leadId: string;
  readonly leadContext: V2DialogLeadContext;
}

@Component({
  selector: 'app-v2-add-documents-dialog',
  imports: [TranslatePipe, V2DialogShell, V2DocumentPicker],
  template: `
    <app-v2-dialog
      [title]="'v2.documents.title' | translate"
      [subtitle]="'v2.documents.subtitle' | translate"
      [leadContext]="leadContext()"
      width="documents"
      [hint]="footerHint()"
      [cancelLabel]="'v2.documents.cancel' | translate"
      [saveLabel]="saveLabel()"
      [saveDisabled]="saving()"
      [invalid]="invalid()"
      [errorCount]="errorCount()"
      [hasUnsavedInput]="documents().length > 0 || note().trim().length > 0"
      (save)="save()"
    >
      @if (saveError(); as message) {
        <p class="v2-add-documents__error" role="alert">{{ message }}</p>
      }

      <app-v2-document-picker [(documents)]="documents" [disabled]="saving()" />

      <label class="v2-add-documents__timeline">
        <!-- TODO(v2): W11 always writes an attachment event; the API has no switch for this. -->
        <input type="checkbox" checked disabled />
        <span>{{ 'v2.documents.postTimeline' | translate }}</span>
      </label>
      <label class="v2-add-documents__note">
        <span>{{ 'v2.documents.note' | translate }}</span>
        <input
          type="text"
          maxlength="1000"
          [value]="note()"
          [disabled]="saving()"
          [placeholder]="'v2.documents.notePlaceholder' | translate"
          (input)="note.set($any($event.target).value)"
        />
      </label>
    </app-v2-dialog>
  `,
  styles: `
    :host {
      display: block;
    }
    .v2-add-documents__timeline {
      display: flex;
      align-items: center;
      gap: 9px;
      color: var(--v2-ink-2);
      font-size: 13px;
    }
    .v2-add-documents__timeline input {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--v2-ink);
    }
    .v2-add-documents__note {
      display: grid;
      gap: 6px;
      color: var(--v2-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.03em;
    }
    .v2-add-documents__note input {
      min-height: 40px;
      box-sizing: border-box;
      padding: 0 12px;
      border: 1px solid var(--v2-line-strong);
      border-radius: var(--v2-radius-sm);
      background: var(--v2-surface);
      color: var(--v2-ink);
      font: inherit;
      font-size: 13px;
      font-weight: 400;
      letter-spacing: normal;
    }
    .v2-add-documents__error {
      margin: 0;
      padding: 10px 12px;
      border-radius: var(--v2-radius-sm);
      background: var(--v2-danger-bg);
      color: var(--v2-danger);
      font-size: 13px;
    }
  `,
})
export class V2AddDocumentsDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly service = inject(V2LeadDocumentsService);
  private readonly i18n = inject(I18nService);
  protected readonly data = inject<V2AddDocumentsData>(DIALOG_DATA);

  protected readonly leadContext = computed(() => this.data.leadContext);
  protected readonly documents = signal<readonly V2PendingDocument[]>([]);
  protected readonly note = signal('');
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly errorCount = computed(() => {
    const invalidFiles = this.documents().filter(
      (document) => document.error === 'type' || document.error === 'size',
    ).length;
    return invalidFiles + (this.documents().length === 0 ? 1 : 0);
  });
  protected readonly invalid = computed(() => this.errorCount() > 0);
  protected readonly readyCount = computed(
    () =>
      this.documents().filter(
        (document) => document.state !== 'error' || document.error === 'upload',
      ).length,
  );
  protected readonly footerHint = computed(() =>
    this.saving()
      ? this.i18n.t('v2.documents.uploading')
      : this.i18n.t('v2.documents.readyCount', { count: this.readyCount() }),
  );
  protected readonly saveLabel = computed(() =>
    this.i18n.t('v2.documents.addCount', { count: this.readyCount() }),
  );

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    this.saving.set(true);
    this.saveError.set('');
    try {
      await this.service.uploadAll(this.data.leadId, this.documents(), this.note(), (id, change) =>
        this.updateDocument(id, change),
      );
      this.dialogRef.close(true);
    } catch (error) {
      this.saveError.set(
        this.i18n.localizeError(
          error instanceof Error ? error.message : 'v2.documents.uploadFailed',
        ),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private updateDocument(id: string, change: Partial<V2PendingDocument>): void {
    this.documents.update((items) =>
      items.map((document) => (document.id === id ? { ...document, ...change } : document)),
    );
  }
}
