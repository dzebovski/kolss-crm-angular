import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { createGlobalPositionStrategy } from '@angular/cdk/overlay';
import type { ComponentType } from '@angular/cdk/portal';
import { inject, InjectionToken, Injector, Service } from '@angular/core';

/** Id of the popup title, so the CDK container can point `aria-labelledby` at it. */
export const V2_DIALOG_TITLE_ID = new InjectionToken<string>('V2_DIALOG_TITLE_ID');

// Lead card v1.3 (Modal): 600px wide, 150px from the top. Smaller viewports keep a 24px
// margin; the popup body scrolls instead (see V2DialogShell).
const DIALOG_WIDTH = 'min(600px, calc(100vw - 32px))';
const DIALOG_TOP = 'clamp(24px, 15vh, 150px)';

let nextTitleId = 0;

/**
 * Opens a v2 popup on the CDK dialog: `scrim` backdrop, focus trap, Escape / backdrop click
 * close without saving (as v1), focus returns to the trigger. The component renders
 * `<app-v2-dialog>` as its root and closes itself through `DialogRef`. Put `cdkFocusInitial`
 * on the field that should get focus first; otherwise the first tabbable element does.
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
      width: DIALOG_WIDTH,
      hasBackdrop: true,
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
