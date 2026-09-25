import { DialogRef } from '@angular/cdk/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { v2PluralCategory } from '@domain/v2/plural';
import type { V2LeadDisplayStatus } from '@domain/v2/lead-view.types';
import { V2Button } from '../v2-button';
import { V2CodeChip } from '../v2-code-chip';
import { V2StatusPill } from '../v2-status-pill';
import { v2ToneColor, type V2Tone } from '../v2-tone';
import { V2_DIALOG_TITLE_ID } from './v2-dialog.service';

/** Header lead-context row (Lost.dc.html): avatar initials, name, code, phone, current status. */
export interface V2DialogLeadContext {
  readonly initials: string;
  readonly name: string;
  readonly code: string;
  readonly phone: string;
  readonly status: V2LeadDisplayStatus;
}

/** Named popup widths (Popup-rules.dc.html "Closing and unsaved data"). */
export type V2DialogWidth = 'form' | 'status' | 'documents';

export type V2DialogPrimaryVariant = 'primary' | 'danger';

// Popup frame built to Popup-rules.dc.html: pinned header (title, one-line purpose, optional
// lead context, close), a scrolling body (fields are projected), and a pinned 72px footer
// (status line on the left, Cancel + primary on the right). The fields are projected. Save
// submits the form (Enter in a field too) and emits `save`; the popup component saves and
// closes itself through `DialogRef`.
//
// Validation anatomy (Popup-rules.dc.html "Validation"): the primary button is never disabled
// for errors. The consumer computes `invalid`/`errorCount` from its own Signal Forms schema
// (e.g. `computed(() => [f.a, f.b].filter((x) => x().errors().length > 0).length)`); on press,
// if `invalid()` the shell swaps the footer to "N fields need attention", scrolls to and
// focuses the first field marked `data-v2-invalid` (set by `V2FormField`/`V2FieldGroup` from
// their own `error` input) and does not emit `save`. `saveDisabled` stays for a real
// concurrency guard (an in-flight save), which is not a validation state.
//
// Closing (Popup-rules.dc.html "Closing and unsaved data"): close (×), Cancel, Esc and a
// backdrop click all call the same `close()`. With `hasUnsavedInput() === false` it closes
// immediately; otherwise the footer swaps in place to a discard confirmation — no second
// modal. `V2DialogService` opens with `disableClose: true` so CDK's own Esc/backdrop handling
// never bypasses this; the shell re-implements both from `DialogRef.keydownEvents` /
// `.backdropClick`.
@Component({
  selector: 'app-v2-dialog',
  imports: [TranslatePipe, V2Button, V2CodeChip, V2StatusPill],
  templateUrl: './v2-dialog-shell.html',
  styleUrl: './v2-dialog-shell.scss',
})
export class V2DialogShell {
  private readonly dialogRef = inject(DialogRef);
  private readonly i18n = inject(I18nService);
  protected readonly titleId = inject(V2_DIALOG_TITLE_ID, { optional: true });

  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');

  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly leadContext = input<V2DialogLeadContext | null>(null);
  /** Coloured dot before the title (status/call-result popups: Lost, Invited to showroom…). */
  readonly statusDot = input<V2Tone | null>(null);
  readonly width = input<V2DialogWidth>('form');

  readonly cancelLabel = input('');
  readonly saveLabel = input.required<string>();
  readonly primaryVariant = input<V2DialogPrimaryVariant>('primary');
  /** Concurrency guard only (e.g. an in-flight save) — never set this for a validation error. */
  readonly saveDisabled = input(false);

  /** Footer "what will happen" status text, shown while there is nothing to flag. */
  readonly hint = input('');
  /** True while required fields are missing or invalid. */
  readonly invalid = input(false);
  /** Count shown in the "N fields need attention" footer message once `invalid()` is pressed. */
  readonly errorCount = input(0);
  /** Drives the close → discard-confirmation swap; false = closing never asks. */
  readonly hasUnsavedInput = input(false);

  readonly save = output<void>();
  /**
   * Fires when Save is pressed while `invalid()` is true (before the footer/focus handling).
   * The consumer's own field `error` inputs are typically gated on having seen this once, so a
   * required field only shows red after a press — not while the person hasn't reached it yet —
   * and clears again as soon as it becomes valid (Popup-rules.dc.html "Validation").
   */
  readonly invalidAttempt = output<void>();

  protected readonly dotColor = computed(() => {
    const tone = this.statusDot();
    return tone === null ? null : v2ToneColor(tone);
  });

  protected readonly submitAttempted = signal(false);
  protected readonly confirming = signal(false);

  protected readonly showErrorStatus = computed(() => this.submitAttempted() && this.invalid());
  protected readonly footerText = computed(() => {
    if (this.showErrorStatus()) {
      const count = this.errorCount();
      const category = v2PluralCategory(this.i18n.locale(), count);
      return this.i18n.t(`v2.dialog.fieldsNeedAttention.${category}`, { count });
    }
    return this.hint();
  });

  constructor() {
    this.dialogRef.keydownEvents.pipe(takeUntilDestroyed()).subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });
    this.dialogRef.backdropClick.pipe(takeUntilDestroyed()).subscribe(() => this.close());
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.saveDisabled()) return;
    if (this.invalid()) {
      this.submitAttempted.set(true);
      this.invalidAttempt.emit();
      this.focusFirstInvalid();
      return;
    }
    this.save.emit();
  }

  protected close(): void {
    if (this.confirming()) return;
    if (this.hasUnsavedInput()) {
      this.confirming.set(true);
      return;
    }
    this.dialogRef.close();
  }

  protected keepEditing(): void {
    this.confirming.set(false);
  }

  protected discard(): void {
    this.dialogRef.close();
  }

  /** Scrolls the first `data-v2-invalid` field into view and focuses its control. */
  private focusFirstInvalid(): void {
    const host = this.body().nativeElement.querySelector<HTMLElement>('[data-v2-invalid]');
    if (!host) return;
    host.scrollIntoView({ block: 'center' });
    const control = host.querySelector<HTMLElement>('input, select, textarea, button');
    (control ?? host).focus();
  }
}
