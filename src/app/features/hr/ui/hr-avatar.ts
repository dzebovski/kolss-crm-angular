import { Component, computed, input } from '@angular/core';

import { hrInitials } from '@domain/hr/hr-entry';

/** Initials circle of a person (HR boards, `.av`): 28px in grids, 56px on the employee page. */
@Component({
  selector: 'app-hr-avatar',
  host: { 'aria-hidden': 'true', '[attr.data-size]': 'size()' },
  template: `{{ initials() }}`,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--v2-surface-sunk);
      color: var(--v2-ink-2);
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
    }

    :host([data-size='lg']) {
      width: 56px;
      height: 56px;
      font-size: 18px;
    }

    :host([data-size='sm']) {
      width: 24px;
      height: 24px;
      font-size: 10px;
    }
  `,
})
export class HrAvatar {
  readonly name = input<string | null>(null);
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  protected readonly initials = computed(() => hrInitials(this.name()));
}
