import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { LeadDetailView } from './lead-detail-page';

@Component({
  selector: 'app-lead-detail-page',
  imports: [LeadDetailView],
  template: `<app-lead-detail-view [leadId]="leadId" />`,
})
export class LeadDetailPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly leadId = this.route.snapshot.paramMap.get('leadId') ?? '';
}
