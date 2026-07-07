import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-root-redirect',
  template: '',
})
export class RootRedirect {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    void this.redirect();
  }

  private async redirect(): Promise<void> {
    if (!this.auth.initialized()) {
      await this.auth.initialize();
    }

    const target = this.auth.isAuthenticated() ? '/crm/dashboard' : '/login';
    await this.router.navigateByUrl(target, { replaceUrl: true });
  }
}
