import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// Empty v2 layout frame from the "KOLSS CRM v2" canvas (Main.dc.html).
// Header content is N1, the side menu is N2; raw values become v2 tokens in F2.
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
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
      background: #f6f6f4;
      color: #17171a;
      font-family: 'Onest', system-ui, sans-serif;
    }

    .v2-shell__header {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: 16px;
      box-sizing: border-box;
      height: 64px;
      padding: 0 24px 0 20px;
      background: #ffffff;
      border-bottom: 1px solid #e6e5e1;
    }

    .v2-shell__body {
      display: flex;
      flex-grow: 1;
      align-items: stretch;
      min-height: 0;
    }

    .v2-shell__main {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      gap: 16px;
      box-sizing: border-box;
      min-width: 0;
      padding: 28px 40px 48px;
    }
  `,
})
export class V2Shell {}
