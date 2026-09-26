import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { createGlobalPositionStrategy } from '@angular/cdk/overlay';
import type { ComponentType } from '@angular/cdk/portal';
import { inject, InjectionToken, Injector, Service } from '@angular/core';

/** Id of the popup title, so the CDK container can point `aria-labelledby` at it. */
export const V2_DIALOG_TITLE_ID = new InjectionToken<string>('V2_DIALOG_TITLE_ID');

// Popup-rules.dc.html "Closing and unsaved data": max height = window − 64px. A flat 32px top
// offset (paired with `.v2-dialog { max-height: calc(100dvh - 64px) }`) keeps that margin
// symmetric top/bottom; the popup's own width (640/560/600, `V2DialogShell.width`) replaces
// the single fixed width this used to set here.
const DIALOG_TOP = '32px';

let nextTitleId = 0;

/**
 * Opens a v2 popup on the CDK dialog: `scrim` backdrop, focus trap, focus returns to the
 * trigger. `disableClose: true` turns off CDK's own Escape/backdrop-click closing so
 * `V2DialogShell` can run its own close() (which asks to discard unsaved input first,
 * Popup-rules.dc.html "Closing and unsaved data") from `DialogRef.keydownEvents` /
 * `.backdropClick` instead. The component renders `<app-v2-dialog>` as its root and closes
 * itself through `DialogRef`. Put `cdkFocusInitial` on the field that should get focus first;
 * otherwise the first tabbable element does.
 */
@Service()
export class V2DialogService {
  private readonly dialog = inject(Dialog);
  private readonly injector = inject(Injector);

  open<Result = unknown, Data = unknown, C = unknown>(
    component: ComponentType<C>,
    data?: Data,
  ): DialogRef<Result, C> {
    const titleId = `v2-dialog-title-${nextTitleId++}`;
    return this.dialog.open<Result, Data, C>(component, {
      data,
      hasBackdrop: true,
      disableClose: true,
      backdropClass: 'v2-dialog-backdrop',
      panelClass: 'v2-dialog-panel',
      positionStrategy: createGlobalPositionStrategy(this.injector)
        .centerHorizontally()
        .top(DIALOG_TOP),
      ariaLabelledBy: titleId,
      restoreFocus: true,
      providers: [{ provide: V2_DIALOG_TITLE_ID, useValue: titleId }],
    });
  }
}
