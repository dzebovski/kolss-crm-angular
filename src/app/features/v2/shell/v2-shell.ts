import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { V2Header } from './v2-header';
import { V2SideMenu } from './v2-side-menu';

// v2 layout frame from the "KOLSS CRM v2" canvas (Main.dc.html): header (N1), body row with
// the side menu (N2) that pushes main aside. The host carries the v2 tokens (F2).
@Component({
  selector: 'app-v2-shell',
  imports: [RouterOutlet, V2Header, V2SideMenu],
  host: { class: 'v2-root' },
  template: `
    <app-v2-header [menuOpen]="menuOpen()" (menuToggle)="toggleMenu()" />
    <div class="v2-shell__body">
      <app-v2-side-menu [open]="menuOpen()" />
      <main class="v2-shell__main">
        <router-outlet />
      </main>
    </div>
  `,
  styleUrl: './v2-shell.scss',
})
export class V2Shell {
  // Closed by default, as on the Main board. N2 renders the side menu from it; N3 remembers it
  // per viewer.
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }
}
