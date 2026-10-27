import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { I18nService } from '@core/i18n/i18n.service';
import type { Lead } from '@domain/lead.types';
import { LeadsService } from '@services/leads.service';
import { UiButton } from '@ui/button/ui-button';
import { UiTextField } from '@ui/form/ui-text-field';

const SEARCH_LIMIT = 20;

const ERROR_KEYS: Readonly<Record<string, string>> = {
  already_duplicate: 'leadDuplicate.errorAlreadyDuplicate',
  original_is_duplicate: 'leadDuplicate.errorOriginalIsDuplicate',
  lead_terminal: 'leadDuplicate.errorTerminal',
};

export interface LeadDuplicateDialogData {
  readonly lead: Pick<Lead, 'id' | 'name' | 'officeCode'>;
}

/** "Duplicate of…": pick the original lead of the same office; returns true once marked. */
@Component({
  selector: 'app-lead-duplicate-dialog',
  imports: [UiButton, UiTextField],
  template: `
    <form class="duplicate-dialog" (submit)="search($event)">
      <header class="duplicate-dialog__heading">
        <h2 id="lead-duplicate-dialog-title">{{ i18n.t('leadDuplicate.title') }}</h2>
        <p>{{ i18n.t('leadDuplicate.hint') }}</p>
      </header>

      <div class="duplicate-dialog__search">
        <app-ui-text-field
          [label]="i18n.t('leadDuplicate.search')"
          [reserveMessageSpace]="false"
          [(value)]="query"
        />
        <app-ui-button type="submit" variant="secondary" [loading]="searching()">
          {{ i18n.t('leadDuplicate.searchButton') }}
        </app-ui-button>
      </div>

      <div
        class="duplicate-dialog__results"
        role="radiogroup"
        aria-labelledby="lead-duplicate-dialog-title"
      >
        @for (candidate of candidates(); track candidate.id) {
          <label
            class="duplicate-dialog__option"
            [class.is-selected]="selectedId() === candidate.id"
          >
            <input
              type="radio"
              name="duplicate-original"
              [value]="candidate.id"
              [checked]="selectedId() === candidate.id"
              (change)="selectedId.set(candidate.id)"
            />
            <span class="duplicate-dialog__reference">{{ candidate.referenceId }}</span>
            <span class="duplicate-dialog__name">{{ candidate.name }}</span>
            <span class="duplicate-dialog__meta">
              {{ candidate.phone }} · {{ i18n.formatDate(candidate.sourceCreatedAt) }} ·
              {{ i18n.clientStatusLabel(candidate.clientStatus) }}
            </span>
          </label>
        } @empty {
          @if (!searching()) {
            <p class="duplicate-dialog__empty">{{ i18n.t('leadDuplicate.empty') }}</p>
          }
        }
      </div>

      @if (error()) {
        <p class="duplicate-dialog__error" role="alert">{{ error() }}</p>
      }

      <footer class="duplicate-dialog__actions">
        <app-ui-button variant="ghost" [disabled]="saving()" (pressed)="dialogRef.close(false)">
          {{ i18n.t('common.cancel') }}
        </app-ui-button>
        <app-ui-button [loading]="saving()" [disabled]="!selectedId()" (pressed)="confirm()">
          {{ i18n.t('leadDuplicate.confirm') }}
        </app-ui-button>
      </footer>
    </form>
  `,
  styles: `
    :host {
      display: block;
    }
    .duplicate-dialog {
      width: min(38rem, calc(100vw - 2rem));
      padding: 1.5rem;
      display: grid;
      gap: 1rem;
    }
    .duplicate-dialog__heading {
      display: grid;
      gap: 0.35rem;
    }
    .duplicate-dialog h2,
    .duplicate-dialog p {
      margin: 0;
    }
    .duplicate-dialog h2 {
      font-family: var(--ui-font-display), sans-serif;
      font-size: 1.5rem;
    }
    .duplicate-dialog__heading p {
      color: var(--ui-text-muted);
      font-size: 0.875rem;
    }
    .duplicate-dialog__search {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.75rem;
      align-items: end;
    }
    .duplicate-dialog__results {
      display: grid;
      gap: 0.5rem;
      max-height: 18rem;
      overflow-y: auto;
    }
    .duplicate-dialog__option {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr);
      grid-template-areas: 'radio ref name' 'radio meta meta';
      column-gap: 0.65rem;
      row-gap: 0.15rem;
      align-items: center;
      padding: 0.65rem 0.8rem;
      border: 1px solid var(--ui-border);
      border-radius: 0.75rem;
      cursor: pointer;
    }
    .duplicate-dialog__option.is-selected {
      border-color: var(--ui-action);
      background: color-mix(in srgb, var(--ui-action) 6%, var(--ui-surface-raised));
    }
    .duplicate-dialog__option input {
      grid-area: radio;
      margin: 0;
    }
    .duplicate-dialog__reference {
      grid-area: ref;
      font-weight: 600;
      color: var(--ui-action);
      font-size: 0.8rem;
    }
    .duplicate-dialog__name {
      grid-area: name;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .duplicate-dialog__meta {
      grid-area: meta;
      color: var(--ui-text-muted);
      font-size: 0.8rem;
    }
    .duplicate-dialog__empty {
      color: var(--ui-text-muted);
      font-size: 0.875rem;
    }
    .duplicate-dialog__error {
      color: var(--ui-danger);
      font-size: 0.8rem;
    }
    .duplicate-dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
  `,
})
export class LeadDuplicateDialog {
  protected readonly i18n = inject(I18nService);
  private readonly leadsService = inject(LeadsService);
  private readonly data = inject<LeadDuplicateDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<LeadDuplicateDialog, boolean>);

  protected readonly query = signal(this.data.lead.name);
  private readonly results = signal<readonly Lead[]>([]);
  protected readonly searching = signal(false);
  protected readonly saving = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly error = signal('');

  /** Only leads of the same office can be the original; the lead itself never is. */
  protected readonly candidates = computed(() =>
    this.results().filter(
      (lead) => lead.id !== this.data.lead.id && lead.officeCode === this.data.lead.officeCode,
    ),
  );

  constructor() {
    void this.runSearch();
  }

  protected search(event: Event): void {
    event.preventDefault();
    void this.runSearch();
  }

  protected async confirm(): Promise<void> {
    const originalId = this.selectedId();
    if (!originalId || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.leadsService.markDuplicate(this.data.lead.id, originalId);
      this.dialogRef.close(true);
    } catch (error) {
      const key = error instanceof KolssApiError ? ERROR_KEYS[error.code] : undefined;
      this.error.set(this.i18n.localizeError(key ?? 'error.actionFailed'));
    } finally {
      this.saving.set(false);
    }
  }

  private async runSearch(): Promise<void> {
    const search = this.query().trim();
    this.searching.set(true);
    this.error.set('');
    try {
      this.results.set(search ? await this.leadsService.list({ search, limit: SEARCH_LIMIT }) : []);
      if (!this.candidates().some((lead) => lead.id === this.selectedId())) {
        this.selectedId.set(null);
      }
    } catch {
      this.error.set(this.i18n.localizeError('error.actionFailed'));
    } finally {
      this.searching.set(false);
    }
  }
}
