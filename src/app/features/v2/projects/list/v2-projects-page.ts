import { Component } from '@angular/core';

import { V2PlaceholderPage } from '../../shell/v2-placeholder-page';

// Placeholder for `/v2/projects` until the Projects list (P3) replaces its contents.
@Component({
  selector: 'app-v2-projects-page',
  imports: [V2PlaceholderPage],
  template: `<app-v2-placeholder-page
    sectionKey="v2.nav.section.sales"
    titleKey="v2.nav.projects"
  />`,
})
export class V2ProjectsPage {}
