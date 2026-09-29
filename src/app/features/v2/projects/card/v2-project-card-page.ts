import { Component, input } from '@angular/core';

import { V2PlaceholderPage } from '../../shell/v2-placeholder-page';

// Placeholder for `/v2/projects/:projectId` until the Project card (P4) replaces its contents.
@Component({
  selector: 'app-v2-project-card-page',
  imports: [V2PlaceholderPage],
  template: `<app-v2-placeholder-page
    sectionKey="v2.nav.section.sales"
    titleKey="v2.nav.projects"
  />`,
})
export class V2ProjectCardPage {
  /** Route parameter `:projectId`, bound through `withComponentInputBinding()`. */
  readonly projectId = input.required<string>();
}
