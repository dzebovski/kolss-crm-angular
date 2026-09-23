import { Component, input } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';

// Placeholder until C1 builds the lead card from the v2 design (v1.3).
@Component({
  selector: 'app-v2-lead-card-page',
  imports: [TranslatePipe],
  template: `
    <h1>{{ 'nav.leads' | translate }}</h1>
    <p>{{ leadId() }}</p>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class V2LeadCardPage {
  readonly leadId = input.required<string>();
}
