import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { UiIcon } from '../../../ui/icon/ui-icon';
import { computeRadialLayout } from './radial-menu.geometry';
import { RadialAction, RadialLayoutConfig } from './radial-menu.types';

export interface RadialActionDialogData<TId extends string = string> {
  readonly title: string;
  readonly hint?: string;
  readonly actions: readonly RadialAction<TId>[];
  readonly layout?: RadialLayoutConfig;
}

@Component({
  selector: 'app-radial-action-dialog',
  imports: [UiIcon],
  template: `
    <section
      class="radial-selector"
      [class.radial-selector--mobile-list]="data.actions.length > 3"
      [style.--radial-grid-width]="layout.gridWidthRem + 'rem'"
      [style.--radial-grid-height]="layout.gridHeightRem + 'rem'"
      [style.--radial-radius]="layout.radiusRem + 'rem'"
      [attr.data-action-count]="data.actions.length"
      [attr.data-button-appearance]="buttonAppearance"
      aria-labelledby="radial-selector-title"
    >
      <h2 id="radial-selector-title" class="visually-hidden">{{ data.title }}</h2>

      <div class="radial-selector__grid">
        <div class="radial-selector__orbit" aria-hidden="true"></div>

        @for (action of layout.actions; track action.id) {
          <button
            type="button"
            class="radial-action"
            [style.--radial-x]="action.xRem + 'rem'"
            [style.--radial-y]="action.yRem + 'rem'"
            [style.--radial-mobile-x]="action.mobileXRem + 'rem'"
            [style.--radial-mobile-y]="action.mobileYRem + 'rem'"
            [style.--radial-delay]="action.animationDelayMs + 'ms'"
            [attr.data-tone]="action.tone"
            [attr.data-testid]="'radial-action-' + action.id"
            [disabled]="action.disabled"
            (click)="select(action.id)"
          >
            <span class="radial-action__icon" aria-hidden="true">
              <app-ui-icon [name]="action.icon" [size]="27" [filled]="true" />
            </span>
            <span>{{ action.label }}</span>
          </button>
        }

        <button
          type="button"
          class="radial-close"
          aria-label="Закрити меню дій"
          data-testid="radial-close"
          (click)="close()"
        >
          <app-ui-icon name="close" [size]="28" />
        </button>
      </div>

      <p class="radial-selector__hint">{{ data.hint ?? data.title }}</p>
    </section>
  `,
  styleUrl: './radial-action-dialog.scss',
})
export class RadialActionDialog {
  protected readonly data = inject<RadialActionDialogData>(MAT_DIALOG_DATA);
  protected readonly layout = computeRadialLayout(this.data.actions, this.data.layout);
  protected readonly buttonAppearance = this.data.layout?.buttonAppearance ?? 'plain';
  private readonly dialogRef = inject(MatDialogRef<RadialActionDialog, string>);

  protected select(actionId: string): void {
    if (this.data.actions.find((action) => action.id === actionId)?.disabled) return;
    this.dialogRef.close(actionId);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
