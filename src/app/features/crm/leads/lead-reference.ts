import { Component, input } from '@angular/core';

export type LeadReferenceAppearance = 'compact' | 'prominent';

@Component({
  selector: 'app-lead-reference',
  host: { '[class.is-prominent]': "appearance() === 'prominent'" },
  template: `<span class="lead-reference">{{ referenceId() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      max-width: 100%;
      vertical-align: middle;
    }

    .lead-reference {
      min-height: 1.15rem;
      padding: 0.08rem 0.38rem;
      border: 1px solid color-mix(in srgb, var(--ui-action) 24%, var(--ui-border));
      border-radius: 0.28rem;
      background: color-mix(in srgb, var(--ui-action) 7%, var(--ui-surface-raised));
      color: var(--ui-action);
      display: inline-flex;
      align-items: center;
      font-size: 0.625rem;
      font-variant-numeric: tabular-nums;
      font-weight: 820;
      letter-spacing: 0.055em;
      line-height: 1;
      white-space: nowrap;
    }

    :host.is-prominent .lead-reference {
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      font-family: var(--ui-font-display), sans-serif;
      font-size: clamp(1.15rem, 2vw, 1.55rem);
      font-weight: 720;
      letter-spacing: 0.075em;
    }

    @media print {
      .lead-reference {
        border-color: #777;
        background: white;
        color: #111;
      }
    }
  `,
})
export class LeadReference {
  readonly referenceId = input.required<string>();
  readonly appearance = input<LeadReferenceAppearance>('compact');
}
