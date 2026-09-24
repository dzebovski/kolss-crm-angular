import { Component, input } from '@angular/core';

import type { V2NavIcon as V2NavIconName } from './v2-nav.config';

// 18px stroke icons of the side menu, paths copied from the "KOLSS CRM v2" canvas
// (Main.dc.html, SIDE MENU). Colour comes from the host's `color`.
@Component({
  selector: 'app-v2-nav-icon',
  host: { 'aria-hidden': 'true' },
  template: `
    <svg width="18" height="18" viewBox="0 0 24 24">
      @switch (name()) {
        @case ('leads') {
          <path d="M4 13l2.5-8h11L20 13" />
          <path d="M4 13v6h16v-6h-5l-1 2h-4l-1-2z" />
        }
        @case ('projects') {
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        }
        @case ('clients') {
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
          <path d="M18 14a6.5 6.5 0 0 1 3.5 6" />
        }
        @case ('meetings-calendar') {
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
        }
        @case ('tasks') {
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l3 3 5-6" />
        }
        @case ('lead-reports') {
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M21 20H3" />
        }
        @case ('funnel-reports') {
          <path d="M3 4h18l-7 8.5V19l-4 2v-8.5z" />
        }
        @case ('accounts') {
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        }
        @case ('platform-settings') {
          <path d="M4 6h10" />
          <path d="M18 6h2" />
          <circle cx="16" cy="6" r="2" />
          <path d="M4 12h4" />
          <path d="M12 12h8" />
          <circle cx="10" cy="12" r="2" />
          <path d="M4 18h10" />
          <path d="M18 18h2" />
          <circle cx="16" cy="18" r="2" />
        }
        @case ('language') {
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
        }
        @case ('impersonate') {
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 11-4.7" />
          <path d="M16 14h6" />
          <path d="M19 11l3 3-3 3" />
        }
        @case ('design-system') {
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <circle cx="17.5" cy="17.5" r="3.5" />
        }
        @case ('logout') {
          <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
          <path d="M10 16l-4-4 4-4" />
          <path d="M6 12h10" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: flex;
      flex-shrink: 0;
    }

    svg {
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class V2NavIcon {
  readonly name = input.required<V2NavIconName>();
}
