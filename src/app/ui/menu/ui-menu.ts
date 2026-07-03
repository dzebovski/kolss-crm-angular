import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { Component, input, output } from '@angular/core';
import { UiIcon, UiIconName } from '../icon/ui-icon';

export interface UiMenuItem {
  readonly value: string;
  readonly label: string;
  readonly icon?: UiIconName;
  readonly disabled?: boolean;
}

@Component({
  selector: 'app-ui-menu',
  imports: [Menu, MenuContent, MenuItem, MenuTrigger, UiIcon],
  template: `
    <div class="ui-menu">
      <button type="button" class="ui-menu__trigger" ngMenuTrigger [menu]="menu">
        {{ label() }}
        <app-ui-icon name="keyboard_arrow_down" [size]="18" />
      </button>
      <div
        ngMenu
        #menu="ngMenu"
        class="ui-menu__panel"
        [class.ui-menu__panel--visible]="menu.visible()"
        (itemSelected)="selected.emit($event)"
      >
        <ng-template ngMenuContent>
          @for (item of items(); track item.value) {
            <button
              type="button"
              ngMenuItem
              class="ui-menu__item"
              [value]="item.value"
              [disabled]="item.disabled ?? false"
            >
              @if (item.icon) {
                <app-ui-icon [name]="item.icon" [size]="18" />
              }
              {{ item.label }}
            </button>
          }
        </ng-template>
      </div>
    </div>
  `,
  styles: `
    .ui-menu {
      position: relative;
      display: inline-block;
    }

    .ui-menu__trigger {
      min-height: var(--ui-control-height);
      padding: 0 var(--ui-space-3);
      border: 1px solid var(--ui-border-strong);
      border-radius: var(--ui-radius-md);
      background: white;
      color: var(--ui-text);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
      font-size: 0.875rem;
      font-weight: 600;
    }

    .ui-menu__panel {
      position: absolute;
      z-index: var(--ui-z-overlay);
      top: calc(100% + var(--ui-space-2));
      right: 0;
      min-width: 12rem;
      padding: var(--ui-space-2);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: white;
      box-shadow: var(--ui-shadow-2);
      opacity: 0;
      pointer-events: none;
      transform: translateY(-0.25rem);
      transition: all var(--ui-duration-fast) var(--ui-ease);
    }

    .ui-menu__panel--visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .ui-menu__item {
      width: 100%;
      min-height: 2.25rem;
      padding: 0 var(--ui-space-3);
      border: 0;
      border-radius: var(--ui-radius-sm);
      background: transparent;
      color: var(--ui-text);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--ui-space-2);
      text-align: left;
      font-size: 0.875rem;
    }

    .ui-menu__item:hover,
    .ui-menu__item[data-active='true'] {
      background: var(--ui-surface-muted);
    }

    .ui-menu__item:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `,
})
export class UiMenu {
  readonly label = input('Actions');
  readonly items = input.required<readonly UiMenuItem[]>();
  readonly selected = output<string>();
}
