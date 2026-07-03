import { Component, input, output } from '@angular/core';

export type UiButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type UiButtonSize = 'small' | 'medium' | 'large';

@Component({
  selector: 'app-ui-button',
  template: `
    <button
      class="ui-button"
      [class.ui-button--primary]="variant() === 'primary'"
      [class.ui-button--secondary]="variant() === 'secondary'"
      [class.ui-button--ghost]="variant() === 'ghost'"
      [class.ui-button--danger]="variant() === 'danger'"
      [class.ui-button--small]="size() === 'small'"
      [class.ui-button--large]="size() === 'large'"
      [class.ui-button--block]="block()"
      [attr.type]="type()"
      [attr.aria-busy]="loading()"
      [disabled]="disabled() || loading()"
      (click)="pressed.emit()"
    >
      @if (loading()) {
        <span class="ui-button__spinner" aria-hidden="true"></span>
      }
      <ng-content />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    :host:has(.ui-button--block) {
      display: flex;
      width: 100%;
    }

    .ui-button {
      min-height: var(--ui-control-height);
      padding: 0 var(--ui-space-4);
      border: 1px solid transparent;
      border-radius: var(--ui-radius-md);
      background: transparent;
      color: inherit;
      font-size: 0.875rem;
      font-weight: 650;
      letter-spacing: -0.01em;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--ui-space-2);
      transition:
        background var(--ui-duration-fast) var(--ui-ease),
        border-color var(--ui-duration-fast) var(--ui-ease),
        box-shadow var(--ui-duration-fast) var(--ui-ease),
        transform var(--ui-duration-fast) var(--ui-ease);
    }

    .ui-button:not(:disabled):active {
      transform: translateY(1px);
    }

    .ui-button--primary {
      background: var(--ui-action);
      color: white;
      box-shadow: 0 6px 18px color-mix(in srgb, var(--ui-action) 22%, transparent);
    }

    .ui-button--primary:hover:not(:disabled) {
      background: var(--ui-action-hover);
    }

    .ui-button--secondary {
      border-color: var(--ui-border-strong);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
    }

    .ui-button--secondary:hover:not(:disabled),
    .ui-button--ghost:hover:not(:disabled) {
      background: var(--ui-surface-muted);
    }

    .ui-button--danger {
      background: var(--ui-danger-soft);
      color: var(--ui-danger);
    }

    .ui-button--danger:hover:not(:disabled) {
      background: color-mix(in srgb, var(--ui-danger) 15%, white);
    }

    .ui-button--small {
      min-height: 2rem;
      padding-inline: var(--ui-space-3);
      font-size: 0.8125rem;
    }

    .ui-button--large {
      min-height: 3rem;
      padding-inline: var(--ui-space-5);
    }

    .ui-button--block {
      width: 100%;
    }

    .ui-button:disabled {
      opacity: 0.46;
      cursor: not-allowed;
      box-shadow: none;
    }

    .ui-button__spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: ui-button-spin 0.7s linear infinite;
    }

    @keyframes ui-button-spin {
      to {
        transform: rotate(1turn);
      }
    }
  `,
})
export class UiButton {
  readonly variant = input<UiButtonVariant>('primary');
  readonly size = input<UiButtonSize>('medium');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly block = input(false);
  readonly pressed = output<void>();
}
