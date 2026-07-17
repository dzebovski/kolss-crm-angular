import { Component, computed, inject, signal } from '@angular/core';
import { Observable, filter, map, of, switchMap } from 'rxjs';

import { UiButton } from '../../../ui/button/ui-button';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { DesignHeader } from '../design-header';
import { CallCommentDialog, CallCommentDialogData } from './call-comment-dialog';
import { RadialActionDialog, RadialActionDialogData } from './radial-action-dialog';
import { RadialDemoLauncher } from './radial-demo-launcher';
import {
  CALL_ACTIONS,
  CALL_RADIAL_LAYOUT,
  RADIAL_DEMO_VARIANTS,
  CallAction,
  CallActionResult,
  CallOutcome,
  MockLeadState,
  RadialDemoVariant,
  RadialDemoVariantId,
} from './radial-menu.types';

const INITIAL_LEAD_STATE: MockLeadState = {
  status: 'new',
  comment: '',
};

function isCallOutcome(value: CallOutcome | undefined): value is CallOutcome {
  return value !== undefined;
}

function isComment(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

@Component({
  selector: 'app-radial-menu-page',
  imports: [DesignHeader, UiButton, UiIcon, RadialDemoLauncher],
  templateUrl: './radial-menu-page.html',
})
export class RadialMenuPage {
  private readonly dialog = inject(UiDialogService);

  protected readonly actions = CALL_ACTIONS;
  protected readonly demoVariants = RADIAL_DEMO_VARIANTS;
  protected readonly leadState = signal<MockLeadState>(INITIAL_LEAD_STATE);
  protected readonly demoSelections = signal<
    Readonly<Partial<Record<RadialDemoVariantId, string>>>
  >({});
  protected readonly selectedAction = computed(() =>
    this.actions.find((action) => action.id === this.leadState().status),
  );
  protected readonly statusLabel = computed(() => this.selectedAction()?.resultLabel ?? 'Новий');

  protected openCallActions(): void {
    this.openRadialDialog<CallOutcome>(
      {
        title: 'Оберіть результат дзвінка',
        hint: 'Оберіть результат дзвінка',
        actions: this.actions,
        layout: CALL_RADIAL_LAYOUT,
      },
      'Результат дзвінка',
    )
      .pipe(
        filter(isCallOutcome),
        switchMap((outcome) => this.resolveOutcome(outcome)),
      )
      .subscribe((result) => this.applyResult(result));
  }

  protected openDemoActions(variant: RadialDemoVariant): void {
    this.openRadialDialog(
      {
        title: variant.title,
        hint: `Оберіть одну з ${variant.actions.length} дій`,
        actions: variant.actions,
        layout: variant.layout,
      },
      `${variant.title}: ${variant.actions.length} дій`,
    )
      .pipe(filter(isDefined))
      .subscribe((actionId) => {
        const selectedAction = variant.actions.find((action) => action.id === actionId);
        if (!selectedAction) return;

        this.demoSelections.update((selections) => ({
          ...selections,
          [variant.id]: selectedAction.label,
        }));
      });
  }

  protected demoSelectionLabel(variantId: RadialDemoVariantId): string {
    return this.demoSelections()[variantId] ?? '';
  }

  protected resetLead(): void {
    this.leadState.set(INITIAL_LEAD_STATE);
  }

  private openRadialDialog<TId extends string>(
    data: RadialActionDialogData<TId>,
    ariaLabel: string,
  ): Observable<TId | undefined> {
    return this.dialog
      .open<RadialActionDialog, RadialActionDialogData<TId>, TId>(RadialActionDialog, {
        data,
        panelClass: 'radial-menu-dialog-panel',
        backdropClass: 'radial-menu-backdrop',
        ariaLabel,
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        maxWidth: '100vw',
        enterAnimationDuration: 0,
        exitAnimationDuration: 0,
      })
      .afterClosed();
  }

  private resolveOutcome(outcome: CallOutcome): Observable<CallActionResult> {
    const action = this.actions.find((candidate) => candidate.id === outcome);
    if (!action) return of({ outcome, comment: '' });

    if (!action.requiresComment) {
      return of({ outcome, comment: '' });
    }

    return this.openCommentDialog(action).pipe(
      filter(isComment),
      map((comment) => ({ outcome, comment })),
    );
  }

  private openCommentDialog(action: CallAction): Observable<string | undefined> {
    return this.dialog
      .open<CallCommentDialog, CallCommentDialogData, string>(CallCommentDialog, {
        data: { action },
        panelClass: ['ui-dialog-panel', 'call-comment-dialog-panel'],
        ariaLabelledBy: 'call-comment-title',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        maxWidth: 'calc(100vw - 1rem)',
        enterAnimationDuration: 0,
        exitAnimationDuration: 0,
      })
      .afterClosed();
  }

  private applyResult(result: CallActionResult): void {
    this.leadState.set({
      status: result.outcome,
      comment: result.comment,
    });
  }
}
