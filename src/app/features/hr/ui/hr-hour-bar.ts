import { Component, computed, input } from '@angular/core';

import { timeToMinutes } from '@domain/hr/hr-dates';

/**
 * Hour bar (HR-components.dc.html, Hour bar): the track spans `axisStart`–`axisEnd` minutes
 * (office hours), hourly ticks, and the planned `start`–`end` as the filled bar.
 */
@Component({
  selector: 'app-hr-hour-bar',
  host: { 'aria-hidden': 'true', '[class.hr-bar--makeup]': 'makeup()' },
  template: `
    @for (tick of ticks(); track tick) {
      <span class="hr-bar__tick" [style.left.%]="tick"></span>
    }
    @if (bar(); as b) {
      <span class="hr-bar__fill" [style.left.%]="b.left" [style.width.%]="b.width"></span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      height: 8px;
      border-radius: var(--v2-radius-pill);
      background: var(--v2-surface-sunk);
      overflow: hidden;
    }

    .hr-bar__tick {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--v2-line-strong);
    }

    .hr-bar__fill {
      position: absolute;
      top: 0;
      bottom: 0;
      border-radius: var(--v2-radius-pill);
      background: var(--v2-ink);
    }

    :host(.hr-bar--makeup) .hr-bar__fill {
      background: var(--v2-event-showroom);
    }
  `,
})
export class HrHourBar {
  readonly axisStart = input.required<number>();
  readonly axisEnd = input.required<number>();
  readonly start = input<string | null>(null);
  readonly end = input<string | null>(null);
  readonly makeup = input(false);

  private readonly span = computed(() => Math.max(1, this.axisEnd() - this.axisStart()));

  protected readonly ticks = computed(() => {
    const out: number[] = [];
    const first = Math.ceil(this.axisStart() / 60) * 60;
    for (let t = first; t < this.axisEnd(); t += 60) {
      if (t > this.axisStart()) out.push(((t - this.axisStart()) / this.span()) * 100);
    }
    return out;
  });

  protected readonly bar = computed(() => {
    const start = timeToMinutes(this.start());
    const end = timeToMinutes(this.end());
    if (start === null || end === null || end <= start) return null;
    const from = Math.max(start, this.axisStart());
    const to = Math.min(end, this.axisEnd());
    if (to <= from) return null;
    return {
      left: ((from - this.axisStart()) / this.span()) * 100,
      width: ((to - from) / this.span()) * 100,
    };
  });
}
