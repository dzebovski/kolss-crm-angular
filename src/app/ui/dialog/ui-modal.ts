import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-ui-modal',
  template: `
    <div
      class="ui-modal-backdrop"
      role="presentation"
      (click)="onBackdropClick($event)"
    >
      <section
        class="ui-modal"
        [class.ui-modal--wide]="wide()"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="labelledBy()"
        (click)="$event.stopPropagation()"
      >
        <ng-content />
      </section>
    </div>
  `,
  styles: `
    .ui-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--ui-z-overlay);
      padding: var(--ui-space-6);
      background: rgb(23 16 32 / 48%);
      display: grid;
      place-items: center;
    }

    .ui-modal {
      width: min(100%, 32rem);
      max-height: calc(100vh - 3rem);
      overflow: auto;
      padding: var(--ui-space-6);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      display: grid;
      gap: var(--ui-space-4);
      box-shadow: var(--ui-shadow-3);
    }

    .ui-modal--wide {
      width: min(100%, 43rem);
    }

    .ui-modal :where(h2) {
      font-family: var(--ui-font-display);
      font-size: 1.5rem;
    }

    .ui-modal :where(h3) {
      margin: 0;
      font-size: 0.875rem;
    }
  `,
  host: {
    '(document:keydown.escape)': 'dismiss()',
  },
})
export class UiModal {
  readonly wide = input(false);
  readonly labelledBy = input<string | null>(null);
  readonly dismissed = output<void>();

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return;
    this.dismiss();
  }

  protected dismiss(): void {
    this.dismissed.emit();
  }
}
