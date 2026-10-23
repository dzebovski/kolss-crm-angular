import { Component, computed, input } from '@angular/core';

import type { V2TaskKind } from '@domain/v2/task.types';
import { V2_TASK_KIND_TONE } from './v2-task-labels';

// Source badge of the Tasks boards (Tasks-my-day-panel.dc.html, `SRC`): a 28px tinted square
// with the kind's glyph in the rows, or (with `label`) the 24px chip with glyph and text in the
// detail panel.
@Component({
  selector: 'app-v2-task-kind-badge',
  template: `
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      @switch (kind()) {
        @case ('call') {
          <path
            d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"
          />
        }
        @case ('visit') {
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
        }
        @case ('comment') {
          <path d="M4 5h16v11H9l-5 4z" />
        }
        @case ('nonext') {
          <path d="M12 3l9.5 17h-19z" />
          <path d="M12 10v4" />
          <path d="M12 17h.01" />
        }
        @case ('list') {
          <path d="M9 6h11" />
          <path d="M9 12h11" />
          <path d="M9 18h11" />
          <path d="M4 6h.01" />
          <path d="M4 12h.01" />
          <path d="M4 18h.01" />
        }
        @default {
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        }
      }
    </svg>
    @if (label()) {
      {{ label() }}
    }
  `,
  host: {
    '[class.v2-task-kind--chip]': '!!label()',
    '[style.color]': 'tone().fg',
    '[style.background]': 'tone().bg',
  },
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--v2-radius-sm);
    }

    :host(.v2-task-kind--chip) {
      width: auto;
      height: 24px;
      gap: 6px;
      padding: 0 var(--v2-space-2);
      border-radius: var(--v2-radius-xs);
      font-size: 12px;
      font-weight: 600;
    }

    svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class V2TaskKindBadge {
  readonly kind = input.required<V2TaskKind>();
  /** Set for the chip form. */
  readonly label = input('');

  protected readonly tone = computed(() => V2_TASK_KIND_TONE[this.kind()]);
}
