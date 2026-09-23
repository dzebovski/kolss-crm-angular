import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { Component, input, output } from '@angular/core';
import { UiIcon, type UiIconName } from '@ui/icon/ui-icon';

export type UiMenuVariant = 'primary' | 'secondary';

export interface UiMenuItem {
  readonly value: string;
  readonly label: string;
  readonly icon?: UiIconName;
  readonly disabled?: boolean;
  /** Marks a navigation destination as the current page. */
  readonly current?: boolean;
}

@Component({
  selector: 'app-ui-menu',
  imports: [Menu, MenuContent, MenuItem, MenuTrigger, UiIcon],
  templateUrl: './ui-menu.html',
  styleUrl: './ui-menu.scss',
})
export class UiMenu {
  readonly label = input('Actions');
  readonly items = input.required<readonly UiMenuItem[]>();
  readonly triggerIcon = input<UiIconName | null>(null);
  readonly align = input<'start' | 'end'>('end');
  readonly variant = input<UiMenuVariant>('secondary');
  readonly selected = output<string>();
}
