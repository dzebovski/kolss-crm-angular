import { CdkTrapFocus } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import { Component, effect, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { UiIcon } from '@ui/icon/ui-icon';

@Component({
  selector: 'app-global-navigation-drawer',
  imports: [CdkTrapFocus, RouterLink, TranslatePipe, UiIcon],
  templateUrl: './global-navigation-drawer.html',
  styleUrl: './global-navigation-drawer.scss',
  host: {
    '(document:keydown.escape)': 'closeFromEscape()',
  },
})
export class GlobalNavigationDrawer {
  private readonly document = inject(DOCUMENT);

  readonly open = input(false);
  readonly currentUrl = input('/leads');
  readonly canManageAccounts = input(false);
  readonly closeRequested = output<void>();

  constructor() {
    effect((onCleanup) => {
      if (!this.open()) return;
      const root = this.document.documentElement;
      const previousOverflow = root.style.overflow;

      root.classList.add('crm-navigation-open');
      root.style.overflow = 'hidden';
      onCleanup(() => {
        root.classList.remove('crm-navigation-open');
        root.style.overflow = previousOverflow;
      });
    });
  }

  protected isCurrent(path: string, exact = false): boolean {
    const currentPath = this.currentUrl().split(/[?#]/, 1)[0] ?? '';
    return exact
      ? currentPath === path
      : currentPath === path || currentPath.startsWith(`${path}/`);
  }

  protected close(): void {
    this.closeRequested.emit();
  }

  protected closeFromEscape(): void {
    if (this.open()) this.close();
  }
}
