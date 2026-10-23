import { inject, Service } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { isOfficeId } from '@core/office/office.config';
import { SessionService } from '@core/session/session.service';
import { V2_NOW } from '../../core/v2-clock';
import { V2DialogService } from '../../ui/dialog/v2-dialog.service';
import {
  V2CreateLeadDialog,
  type V2CreateLeadData,
  type V2CreateLeadPrefill,
} from './v2-create-lead-dialog';

/**
 * Opens the Create lead popup (leads list, empty Clients list, client card) and, once the lead
 * exists, its card. The popup keeps its own copy of the office list so the launcher stays small.
 */
@Service()
export class V2CreateLeadLauncher {
  private readonly dialogs = inject(V2DialogService);
  private readonly session = inject(SessionService);
  private readonly clock = inject(V2_NOW);
  private readonly router = inject(Router);

  async open(prefill?: V2CreateLeadPrefill): Promise<void> {
    const filter = this.session.officeFilter();
    let createdId: string | null = null;
    const ref = this.dialogs.open<string, V2CreateLeadData>(V2CreateLeadDialog, {
      offices: this.session.officeContext()?.filterOffices ?? [],
      defaultOffice: prefill?.showroom ?? (isOfficeId(filter) ? filter : ''),
      now: this.clock(),
      prefill,
      onCreated: (id) => (createdId = id),
    });
    const leadId = (await firstValueFrom(ref.closed)) ?? createdId;
    if (leadId) void this.router.navigate(['/v2/leads', leadId]);
  }
}
