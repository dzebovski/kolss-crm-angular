import { Component, input } from '@angular/core';

import { LeadDetailView } from './lead-detail-page';

@Component({
  selector: 'app-lead-detail-page',
  imports: [LeadDetailView],
  template: `<app-lead-detail-view [leadId]="leadId()" />`,
})
export class LeadDetailPage {
  readonly leadId = input.required<string>();
}
