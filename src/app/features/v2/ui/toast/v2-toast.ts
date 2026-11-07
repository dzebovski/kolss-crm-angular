import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Component, inject, input, Service } from '@angular/core';

const TOAST_MS = 5000;

// Toast: an `ink` bar with `on-ink` text, centred at the bottom edge (owner decision 2026-09-29:
// "The lead is now in status Project."). It renders in the CDK overlay, so it outlives the
// page that raised it (e.g. across the navigation to the new project) and carries its own
// tokens. Announced politely; nothing to click, it goes away by itself.
@Component({
  selector: 'app-v2-toast',
  template: `{{ message() }}`,
  host: { role: 'status', 'aria-live': 'polite' },
  styleUrl: './v2-toast.scss',
})
export class V2Toast {
  readonly message = input.required<string>();
}

@Service()
export class V2ToastService {
  private readonly overlay = inject(Overlay);
  private ref: OverlayRef | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** Shows one toast at a time; a new message replaces the previous one. */
  show(message: string): void {
    this.dismiss();
    const ref = this.overlay.create({
      positionStrategy: this.overlay.position().global().centerHorizontally().bottom('24px'),
    });
    const component = ref.attach(new ComponentPortal(V2Toast));
    component.setInput('message', message);
    this.ref = ref;
    this.timer = setTimeout(() => this.dismiss(), TOAST_MS);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.ref?.dispose();
    this.ref = null;
  }
}
