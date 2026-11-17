import { Component, computed, input } from '@angular/core';

/**
 * Balance tile (HR-components.dc.html, Balance tiles): label, value, sub line; with `limit`
 * a meter of `used` (warn tone and an over segment when `used > limit`); `empty` mutes it.
 */
@Component({
  selector: 'app-hr-balance-tile',
  host: { '[class.hr-tile--warn]': 'over() > 0', '[class.hr-tile--empty]': 'empty()' },
  template: `
    <span class="hr-tile__label">{{ label() }}</span>
    <span class="hr-tile__value">{{ value() }}</span>
    @if (limit() !== null) {
      <span class="hr-tile__meter" aria-hidden="true">
        <span class="hr-tile__used" [style.width.%]="usedWidth()"></span>
        @if (over() > 0) {
          <span class="hr-tile__over" [style.width.%]="overWidth()"></span>
        }
      </span>
    }
    @if (sub()) {
      <span class="hr-tile__sub">{{ sub() }}</span>
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-sizing: border-box;
      min-width: 0;
      padding: 16px;
      background: var(--v2-surface);
      border: 1px solid var(--v2-line);
      border-radius: var(--v2-radius-lg);
    }

    .hr-tile__label {
      color: var(--v2-muted);
      font-size: 13px;
      line-height: 1.3;
    }

    .hr-tile__value {
      font-size: 22px;
      font-weight: 600;
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
    }

    :host(.hr-tile--warn) .hr-tile__value {
      color: var(--v2-warning-ink);
    }

    :host(.hr-tile--empty) .hr-tile__value {
      color: var(--v2-subtle);
    }

    .hr-tile__meter {
      display: flex;
      height: 6px;
      border-radius: var(--v2-radius-pill);
      background: var(--v2-surface-sunk);
      overflow: hidden;
    }

    .hr-tile__used {
      background: var(--v2-success-ink);
    }

    :host(.hr-tile--warn) .hr-tile__used {
      background: var(--v2-warning-ink);
    }

    .hr-tile__over {
      background: var(--v2-danger);
    }

    .hr-tile__sub {
      color: var(--v2-muted);
      font-size: 12px;
      line-height: 1.4;
    }
  `,
})
export class HrBalanceTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly sub = input('');
  readonly used = input(0);
  readonly limit = input<number | null>(null);
  readonly empty = input(false);

  protected readonly over = computed(() => {
    const limit = this.limit();
    return limit === null ? 0 : Math.max(0, this.used() - limit);
  });
  private readonly total = computed(() => Math.max(this.limit() ?? 0, this.used(), 1));
  protected readonly usedWidth = computed(
    () => (Math.min(this.used(), this.limit() ?? this.used()) / this.total()) * 100,
  );
  protected readonly overWidth = computed(() => (this.over() / this.total()) * 100);
}
