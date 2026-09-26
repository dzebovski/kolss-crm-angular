import { Component, computed, input } from '@angular/core';

import { v2ToneColor, type V2Tone } from './v2-tone';

export type V2ButtonVariant = 'primary' | 'secondary' | 'outlined' | 'call-result' | 'danger';
export type V2ButtonSize = 'sm' | 'md' | 'lg';

// Button from the design system (components/Button) with the sizes used on the boards:
// sm 36px (Edit contact info), md 40px (default), lg 44px (Create project). `call-result`
// is always 48px. `dot` draws the 8px status dot before the label (call result and lead
// status buttons). Icons are projected with the label; the consumer sizes them.
@Component({
  // Attribute selector on the native element keeps button/link semantics, `type`, `disabled`
  // and `routerLink` without forwarding them.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[appV2Button], a[appV2Button]',
  template: `
    @if (dotColor(); as color) {
      <span class="v2-button__dot" [style.background]="color" aria-hidden="true"></span>
    }
    <ng-content />
  `,
  host: {
    class: 'v2-button',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
  },
  styleUrl: './v2-button.scss',
})
export class V2Button {
  readonly variant = input<V2ButtonVariant>('secondary');
  readonly size = input<V2ButtonSize>('md');
  readonly dot = input<V2Tone | null>(null);

  protected readonly dotColor = computed(() => {
    const tone = this.dot();
    return tone === null ? null : v2ToneColor(tone);
  });
}
