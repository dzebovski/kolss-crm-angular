import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  model,
  output,
  resource,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2LeadListItem } from '@domain/v2/lead-view.types';
import { V2LeadsListService } from '@services/v2/v2-leads-list.service';
import { V2CodeChip } from '../ui/v2-code-chip';

/** Typing delay before the search goes to the API. */
const SEARCH_DELAY_MS = 250;
const MAX_RESULTS = 8;

// Lead picker of New task ("Search a lead…"): a search field over `GET /v1/leads`, the matches
// (code, name, phone) below it, and the chosen lead as a chip with a Clear button. The value is the
// lead id; `picked` carries the whole row so the popup can read the lead's office.
@Component({
  selector: 'app-v2-task-lead-picker',
  imports: [TranslatePipe, V2CodeChip],
  template: `
    @if (selected(); as lead) {
      <div class="v2-lead-picker__chosen">
        <app-v2-code-chip [code]="lead.code" size="sm" />
        <span class="v2-lead-picker__name">{{ lead.name }}</span>
        <span class="v2-lead-picker__phone">{{ lead.phone }}</span>
        <button type="button" class="v2-lead-picker__clear" (click)="clear()">
          {{ 'v2.tasks.pick.change' | translate }}
        </button>
      </div>
    } @else {
      <input
        type="search"
        class="v2-lead-picker__input"
        autocomplete="off"
        [attr.aria-label]="'v2.tasks.pick.lead' | translate"
        [placeholder]="'v2.tasks.pick.lead' | translate"
        [value]="text()"
        (input)="onInput($any($event.target).value)"
      />
      @if (query()) {
        <ul class="v2-lead-picker__results" [attr.aria-label]="'v2.tasks.pick.results' | translate">
          @for (lead of results(); track lead.id) {
            <li>
              <button type="button" class="v2-lead-picker__option" (click)="choose(lead)">
                <app-v2-code-chip [code]="lead.code" size="sm" />
                <span class="v2-lead-picker__name">{{ lead.name }}</span>
                <span class="v2-lead-picker__phone">{{ lead.phone }}</span>
              </button>
            </li>
          }
        </ul>
        <p class="v2-lead-picker__status" role="status">{{ statusText() }}</p>
      }
    }
  `,
  styles: `
    @use '../../../../styles/v2/interactive';

    :host {
      display: flex;
      flex-direction: column;
      gap: var(--v2-space-2);
    }

    .v2-lead-picker__input {
      width: 100%;
      height: var(--v2-control-md);
      box-sizing: border-box;
      padding: 0 var(--v2-space-3);
      background: var(--v2-surface);
      border: 1px solid var(--v2-field-tone, var(--v2-line-strong));
      border-radius: var(--v2-radius-sm);
      color: var(--v2-ink);
      font: inherit;
      font-size: 14px;

      @include interactive.transition;

      &:hover {
        border-color: var(--v2-line-hover);
      }

      &:focus {
        border-color: var(--v2-ink);
        outline: 2px solid var(--v2-ink);
        outline-offset: -1px;
      }
    }

    .v2-lead-picker__results {
      margin: 0;
      padding: 0;
      overflow: hidden;
      list-style: none;
      border: 1px solid var(--v2-line);
      border-radius: var(--v2-radius-sm);

      &:empty {
        display: none;
      }
    }

    .v2-lead-picker__option {
      display: flex;
      align-items: center;
      gap: var(--v2-space-2);
      width: 100%;
      min-height: var(--v2-control-md);
      padding: 0 var(--v2-space-3);
      border: 0;
      border-bottom: 1px solid var(--v2-line-soft);
      background: var(--v2-surface);
      color: var(--v2-ink);
      font: inherit;
      font-size: 14px;
      text-align: left;
      cursor: pointer;

      @include interactive.states(ghost, -2px);
    }

    li:last-child .v2-lead-picker__option {
      border-bottom: 0;
    }

    .v2-lead-picker__chosen {
      display: flex;
      align-items: center;
      gap: var(--v2-space-2);
      min-height: var(--v2-control-md);
      padding: 0 var(--v2-space-2) 0 var(--v2-space-3);
      border: 1px solid var(--v2-line-strong);
      border-radius: var(--v2-radius-sm);
      background: var(--v2-surface);
    }

    .v2-lead-picker__name {
      overflow: hidden;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .v2-lead-picker__phone {
      margin-left: auto;
      color: var(--v2-muted);
      font-size: 12px;
      white-space: nowrap;
    }

    .v2-lead-picker__clear {
      padding: 0 var(--v2-space-2);
      height: 28px;
      border: 0;
      border-radius: var(--v2-radius-xs);
      background: transparent;
      color: var(--v2-ink);
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;

      @include interactive.states(ghost);
    }

    .v2-lead-picker__status {
      margin: 0;
      color: var(--v2-muted);
      font-size: 12px;
    }
  `,
})
export class V2TaskLeadPicker {
  private readonly leads = inject(V2LeadsListService);
  private readonly i18n = inject(I18nService);

  /** The chosen lead's id. */
  readonly value = model('');
  /** Narrows the search to one office, when the header picked one. */
  readonly officeId = input<string | null>(null);

  readonly picked = output<V2LeadListItem | null>();

  protected readonly text = signal('');
  /** What the API is asked for, after the typing delay. */
  protected readonly query = signal('');
  protected readonly selected = signal<V2LeadListItem | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  private readonly search = resource({
    params: () => (this.query().trim() ? this.query().trim() : undefined),
    loader: async ({ params }) =>
      (
        await this.leads.list(
          {
            officeId: this.officeId(),
            days: null,
            createdFrom: null,
            createdTo: null,
            search: params,
            statuses: [],
            ratings: [],
          },
          '',
        )
      ).items.slice(0, MAX_RESULTS),
  });

  protected readonly results = computed(() => (this.search.hasValue() ? this.search.value() : []));
  protected readonly statusText = computed(() => {
    this.i18n.locale();
    if (this.search.status() === 'error') return this.i18n.t('v2.tasks.pick.error');
    if (this.search.isLoading()) return this.i18n.t('v2.tasks.pick.searching');
    return this.results().length === 0 ? this.i18n.t('v2.tasks.pick.none') : '';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onInput(text: string): void {
    this.text.set(text);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.query.set(text), SEARCH_DELAY_MS);
  }

  protected choose(lead: V2LeadListItem): void {
    this.selected.set(lead);
    this.value.set(lead.id);
    this.picked.emit(lead);
  }

  protected clear(): void {
    this.selected.set(null);
    this.value.set('');
    this.picked.emit(null);
  }
}
