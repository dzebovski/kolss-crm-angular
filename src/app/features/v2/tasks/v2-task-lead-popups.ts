import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { UsersService } from '@services/users.service';
import { V2LeadCardService } from '@services/v2/v2-lead-card.service';
import { V2_NOW } from '../core/v2-clock';
import { V2CommentDialog, type V2CommentData } from '../leads/card/v2-comment-dialog';
import {
  V2StatusDialog,
  type V2StatusDialogData,
  type V2StatusKind,
} from '../leads/card/v2-status-dialog';
import { V2DialogService } from '../ui/dialog/v2-dialog.service';

/**
 * Opens the lead card's popups from a task: a call-back closes through the call-result popups and
 * "No next step" through Add comment (Q-T4). The lead is loaded first, as the popups need it.
 * Resolves `true` after a save; throws when the lead cannot be loaded.
 */
@Service()
export class V2TaskLeadPopups {
  private readonly dialogs = inject(V2DialogService);
  private readonly leads = inject(V2LeadCardService);
  private readonly users = inject(UsersService);
  private readonly clock = inject(V2_NOW);

  async openStatus(leadId: string, kind: V2StatusKind): Promise<boolean> {
    const [loaded, employees] = await this.load(leadId);
    const ref = this.dialogs.open<boolean, V2StatusDialogData>(V2StatusDialog, {
      kind,
      lead: loaded.lead,
      columns: loaded.columns,
      employees,
      now: this.clock(),
    });
    return (await firstValueFrom(ref.closed)) === true;
  }

  async openComment(leadId: string): Promise<boolean> {
    const [loaded, employees] = await this.load(leadId);
    const ref = this.dialogs.open<boolean, V2CommentData>(V2CommentDialog, {
      leadId,
      lead: loaded.lead,
      columns: loaded.columns,
      employees,
      now: this.clock(),
    });
    return (await firstValueFrom(ref.closed)) === true;
  }

  private async load(leadId: string) {
    const [loaded, employees] = await Promise.all([
      this.leads.load(leadId),
      this.users.listManagers(),
    ]);
    if (!loaded) throw new Error('error.actionFailed');
    return [loaded, employees] as const;
  }
}
