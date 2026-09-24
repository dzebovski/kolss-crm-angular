import { Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { OFFICE_CONFIG } from '@core/office/office.config';
import * as leadPolicy from '@core/policy/lead.policy';
import { isSuperAdminRole } from '@core/roles/roles';
import { SessionService } from '@core/session/session.service';
import { formatV2CardDate, formatV2DayRecency, formatV2Time } from '@domain/v2/date-format';
import { toV2LeadCard } from '@domain/v2/lead-card.mapper';
import { UsersService } from '@services/users.service';
import { V2LeadCardService } from '@services/v2/v2-lead-card.service';
import { V2_NOW } from '../../core/v2-clock';
import { V2DialogService } from '../../ui/dialog/v2-dialog.service';
import { V2Button } from '../../ui/v2-button';
import { V2EmptyState } from '../../ui/v2-empty-state';
import { V2_CHANNEL_LABEL } from '../../ui/v2-lead-labels';
import { V2EditContactDialog, type V2EditContactData } from './v2-edit-contact-dialog';
import { V2LeadCardHeader } from './v2-lead-card-header';

// Lead card v1.3 (`/v2/leads/:leadId`): breadcrumb, meta row, project banner, header card (C1).
// The action panel (C2), info cards (C4) and timeline (C5) follow below the header. Data comes
// from `GET /v1/leads/{id}` (shared v1 mapping + the v2 columns).
@Component({
  selector: 'app-v2-lead-card-page',
  imports: [RouterLink, TranslatePipe, V2Button, V2EmptyState, V2LeadCardHeader],
  templateUrl: './v2-lead-card-page.html',
  styleUrl: './v2-lead-card-page.scss',
})
export class V2LeadCardPage {
  private readonly service = inject(V2LeadCardService);
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly i18n = inject(I18nService);
  private readonly dialogs = inject(V2DialogService);
  private readonly clock = inject(V2_NOW);

  readonly leadId = input.required<string>();

  private readonly leadResource = resource({
    params: () => this.leadId(),
    loader: ({ params }) => this.service.load(params),
  });

  // Manager names come from the employees list, as in v1.
  private readonly employeesResource = resource({
    loader: () => this.usersService.listManagers(),
  });
  private readonly employees = computed(() =>
    this.employeesResource.hasValue() ? this.employeesResource.value() : [],
  );

  /** Taken when the lead arrives, so ages stay stable between reloads. */
  protected readonly now = computed(() => {
    this.leadResource.status();
    return this.clock();
  });

  protected readonly loading = computed(
    () => this.leadResource.isLoading() && !this.leadResource.hasValue(),
  );
  protected readonly notFound = computed(
    () => this.leadResource.hasValue() && this.leadResource.value() === null,
  );
  protected readonly loadError = computed(() => {
    if (this.leadResource.status() !== 'error') return '';
    const error = this.leadResource.error();
    return error instanceof Error ? this.i18n.localizeError(error.message) : '';
  });

  private readonly loaded = computed(() =>
    this.leadResource.hasValue() ? this.leadResource.value() : null,
  );
  protected readonly card = computed(() => {
    const loaded = this.loaded();
    return loaded ? toV2LeadCard(loaded.lead, loaded.columns) : null;
  });

  protected readonly managerName = computed(() => {
    const id = this.card()?.managerId;
    return id
      ? (this.employees().find((employee) => employee.id === id)?.displayName ?? null)
      : null;
  });

  protected readonly canEdit = computed(() => {
    const lead = this.loaded()?.lead;
    return lead ? leadPolicy.canEditLead(this.policyContext(), lead) : false;
  });

  protected readonly meta = computed(() => {
    const card = this.card();
    if (!card) return null;
    const now = this.now();
    const locale = this.i18n.locale();
    const stamp = (value: string) =>
      `${formatV2CardDate(value, now, locale)}, ${formatV2Time(value)}`;
    return {
      recency: formatV2DayRecency(card.lastUpdate.at, now, locale),
      updated: stamp(card.lastUpdate.at),
      updatedBy: card.lastUpdate.actorName || this.i18n.t('v2.card.system'),
      created: stamp(card.createdAt),
      channelKey: V2_CHANNEL_LABEL[card.channel],
      officeKey: OFFICE_CONFIG[card.officeId].nameKey,
      projectDate: card.projectAt ? formatV2CardDate(card.projectAt, now, locale) : null,
    };
  });

  protected retry(): void {
    this.leadResource.reload();
  }

  protected async openEditContact(): Promise<void> {
    const loaded = this.loaded();
    const card = this.card();
    if (!loaded || !card || !this.canEdit()) return;
    const ref = this.dialogs.open<boolean, V2EditContactData>(V2EditContactDialog, {
      lead: loaded.lead,
      card,
      employees: this.employees(),
      canAssignManager: isSuperAdminRole(this.auth.profile()?.role),
    });
    if (await firstValueFrom(ref.closed)) this.leadResource.reload();
  }

  private policyContext(): leadPolicy.LeadPolicyContext {
    return {
      permissions: this.auth.me()?.permissions,
      isSuperAdmin: this.session.officeContext()?.isSuperAdmin ?? false,
      userOffices: this.session.officeContext()?.userOffices ?? [],
      userId: this.auth.sessionContext()?.user.id ?? null,
    };
  }
}
