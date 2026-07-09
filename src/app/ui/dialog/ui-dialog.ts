import { Component, inject, Injectable, Type } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { UiButton } from '../button/ui-button';

/** Shared MatDialog options: backdrop click and Escape close without saving. */
export const UI_DIALOG_DEFAULTS = {
  autoFocus: 'first-tabbable' as const,
  restoreFocus: true,
  panelClass: 'ui-dialog-panel',
  disableClose: false,
};

export interface UiConfirmDialogConfig {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly danger?: boolean;
}

@Component({
  selector: 'app-ui-confirm-dialog',
  imports: [UiButton],
  template: `
    <div class="ui-dialog">
      <div class="ui-dialog__mark" aria-hidden="true"></div>
      <h2>{{ data.title }}</h2>
      <p>{{ data.description }}</p>
      <div class="ui-dialog__actions">
        <app-ui-button variant="ghost" (pressed)="close(false)">
          {{ data.cancelLabel ?? 'Cancel' }}
        </app-ui-button>
        <app-ui-button [variant]="data.danger ? 'danger' : 'primary'" (pressed)="close(true)">
          {{ data.confirmLabel ?? 'Confirm' }}
        </app-ui-button>
      </div>
    </div>
  `,
  styles: `
    .ui-dialog {
      width: min(28rem, calc(100vw - 2rem));
      padding: var(--ui-space-6);
      border-radius: var(--ui-radius-lg);
      background: white;
    }

    .ui-dialog__mark {
      width: 2.75rem;
      height: 0.3rem;
      border-radius: var(--ui-radius-pill);
      background: var(--ui-brand-gradient);
    }

    h2 {
      margin: var(--ui-space-5) 0 var(--ui-space-2);
      font-family: var(--ui-font-display);
      font-size: 1.5rem;
      letter-spacing: -0.035em;
    }

    p {
      margin: 0;
      color: var(--ui-text-muted);
      font-size: 0.875rem;
    }

    .ui-dialog__actions {
      margin-top: var(--ui-space-6);
      display: flex;
      justify-content: flex-end;
      gap: var(--ui-space-2);
    }
  `,
})
export class UiConfirmDialog {
  protected readonly data = inject<UiConfirmDialogConfig>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<UiConfirmDialog, boolean>);

  protected close(result: boolean) {
    this.dialogRef.close(result);
  }
}

@Injectable({ providedIn: 'root' })
export class UiDialogService {
  private readonly dialog = inject(MatDialog);

  confirm(config: UiConfirmDialogConfig) {
    return this.dialog.open<UiConfirmDialog, UiConfirmDialogConfig, boolean>(UiConfirmDialog, {
      ...UI_DIALOG_DEFAULTS,
      data: config,
    });
  }

  open<T, D = unknown, R = unknown>(component: Type<T>, config?: MatDialogConfig<D>) {
    return this.dialog.open<T, D, R>(component, {
      ...UI_DIALOG_DEFAULTS,
      ...config,
    });
  }
}
