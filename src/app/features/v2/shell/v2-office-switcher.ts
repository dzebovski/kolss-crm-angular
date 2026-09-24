import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { Component, computed, inject } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { isOfficeId, OFFICE_CONFIG } from '@core/office/office.config';
import { SessionService } from '@core/session/session.service';
import type { OfficeFilter } from '@domain/office.types';

interface OfficeOption {
  readonly value: OfficeFilter;
  readonly label: string;
  readonly hint: string;
}

// Office switcher from the "KOLSS CRM v2" canvas (Main.dc.html, header "Office switcher";
// open state on Leads-menu-open.dc.html). Drives `SessionService.officeFilter`, as the v1
// header picker does. The header renders it only when `SessionService.showOfficeFilter()`.
@Component({
  selector: 'app-v2-office-switcher',
  imports: [Menu, MenuContent, MenuItem, MenuTrigger, TranslatePipe],
  template: `
    <button type="button" class="v2-office__trigger" ngMenuTrigger [menu]="menu">
      <svg class="v2-office__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
      </svg>
      <span class="v2-office__prefix">{{ 'v2.header.office' | translate }}</span>
      <span>{{ currentLabel() }}</span>
      <svg class="v2-office__chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div
      ngMenu
      #menu="ngMenu"
      class="v2-office__panel"
      [class.v2-office__panel--visible]="menu.visible()"
      [attr.aria-label]="'v2.header.switchOffice' | translate"
      (itemSelected)="select($event)"
    >
      <ng-template ngMenuContent>
        <div class="v2-office__heading" aria-hidden="true">
          {{ 'v2.header.showDataFor' | translate }}
        </div>
        @for (option of options(); track option.value) {
          <button
            type="button"
            ngMenuItem
            role="menuitemradio"
            class="v2-office__item"
            [class.v2-office__item--current]="option.value === current()"
            [value]="option.value"
            [attr.aria-checked]="option.value === current()"
          >
            <span class="v2-office__label">{{ option.label }}</span>
            <span class="v2-office__hint">{{ option.hint }}</span>
            @if (option.value === current()) {
              <svg
                class="v2-office__check"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M5 12l5 5L19 7" />
              </svg>
            }
          </button>
        }
      </ng-template>
    </div>
  `,
  styleUrl: './v2-office-switcher.scss',
})
export class V2OfficeSwitcher {
  private readonly session = inject(SessionService);
  private readonly i18n = inject(I18nService);

  protected readonly current = this.session.officeFilter;

  /** All offices first, then the viewer's offices in `OFFICE_CONFIG` order. */
  protected readonly options = computed<readonly OfficeOption[]>(() => {
    const officeIds = (this.session.officeContext()?.filterOffices ?? [])
      .map((office) => office.code)
      .filter(isOfficeId)
      .sort((a, b) => OFFICE_CONFIG[a].sortOrder - OFFICE_CONFIG[b].sortOrder);
    const offices = officeIds.map((id) => ({
      value: id,
      label: this.i18n.t(OFFICE_CONFIG[id].nameKey),
      hint: this.i18n.t('v2.header.officeCodes', { prefix: OFFICE_CONFIG[id].referencePrefix }),
    }));
    return [
      {
        value: 'all',
        label: this.i18n.t('office.all'),
        hint: offices.map((office) => office.label).join(' + '),
      },
      ...offices,
    ];
  });

  protected readonly currentLabel = computed(
    () => this.options().find((option) => option.value === this.current())?.label ?? '',
  );

  protected select(value: OfficeFilter): void {
    this.session.setOfficeFilter(value);
  }
}
