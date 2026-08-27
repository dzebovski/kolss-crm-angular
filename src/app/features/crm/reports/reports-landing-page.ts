import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { UiIcon } from '@ui/icon/ui-icon';

@Component({
  selector: 'app-reports-landing-page',
  imports: [RouterLink, TranslatePipe, UiIcon],
  templateUrl: './reports-landing-page.html',
  styleUrl: './reports-landing-page.scss',
})
export class ReportsLandingPage {}
