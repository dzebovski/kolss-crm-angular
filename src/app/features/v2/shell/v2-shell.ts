import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// Empty v2 layout frame from the "KOLSS CRM v2" canvas (Main.dc.html).
// Header content is N1, the side menu is N2. The host carries the v2 tokens (F2).
@Component({
  selector: 'app-v2-shell',
  imports: [RouterOutlet],
  host: { class: 'v2-root' },
  template: `
    <header class="v2-shell__header"></header>
    <div class="v2-shell__body">
      <main class="v2-shell__main">
        <router-outlet />
      </main>
    </div>
  `,
  styleUrl: './v2-shell.scss',
})
export class V2Shell {}
