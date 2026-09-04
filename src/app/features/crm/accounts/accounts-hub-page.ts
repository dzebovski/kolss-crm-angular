import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { UiIcon } from '@ui/icon/ui-icon';

@Component({
  selector: 'app-accounts-hub-page',
  imports: [RouterLink, TranslatePipe, UiIcon],
  templateUrl: './accounts-hub-page.html',
  styleUrl: './accounts-hub-page.scss',
})
export class AccountsHubPage {}
