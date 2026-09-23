import { Component } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';

@Component({
  selector: 'app-projects-page',
  imports: [TranslatePipe],
  template: `<h1>{{ 'nav.projects' | translate }}</h1>`,
  styles: `
    :host {
      display: block;
    }

    h1 {
      margin: 0;
      font-family: var(--ui-font-display), sans-serif;
      font-size: clamp(1.9rem, 4vw, 3rem);
      line-height: 1;
    }
  `,
})
export class ProjectsPage {}
