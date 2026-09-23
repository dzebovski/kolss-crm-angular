import { Component } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';

// Placeholder until L1 builds the leads list from the v2 design.
@Component({
  selector: 'app-v2-leads-page',
  imports: [TranslatePipe],
  template: `<h1>{{ 'nav.leads' | translate }}</h1>`,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class V2LeadsPage {}
