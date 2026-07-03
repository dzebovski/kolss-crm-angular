import { Component, computed, input } from '@angular/core';
import { UI_ICON_PATHS, UiIconName } from './ui-icon.registry';

export type { UiIconName } from './ui-icon.registry';

@Component({
  selector: 'app-ui-icon',
  template: `
    <svg
      class="ui-icon"
      viewBox="0 -960 960 960"
      focusable="false"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [attr.aria-hidden]="label() ? null : 'true'"
      [attr.aria-label]="label() || null"
      [attr.role]="label() ? 'img' : null"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
      line-height: 1;
    }

    .ui-icon {
      display: block;
      flex: 0 0 auto;
      fill: currentColor;
    }
  `,
})
export class UiIcon {
  readonly name = input.required<UiIconName>();
  readonly label = input('');
  readonly size = input(20);
  readonly filled = input(false);
  protected readonly path = computed(() => {
    const icon = UI_ICON_PATHS[this.name()];
    return this.filled() && 'filled' in icon ? icon.filled : icon.outline;
  });
}
