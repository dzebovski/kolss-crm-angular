import { Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import {
  presentEventBodyFromLeadEvent,
  presentEventTitleFromLeadEvent,
} from '../../../core/i18n/event-presenter';
import { I18nService } from '../../../core/i18n/i18n.service';
import { isSuperAdminRole } from '../../../core/roles/roles';
import {
  callStatusTone,
  clientStatusTone,
  defaultCurrencyForOffice,
  leadIsTerminal,
} from '../../../services/crm-mock.helpers';
import type {
  CallStatus,
  ClientStatus,
  LeadEvent,
  MockLead,
} from '../../../services/crm-mock.types';
import { LeadActivitiesService } from '../../../services/lead-activities.service';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { UiButton } from '../../../ui/button/ui-button';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { UiModal } from '../../../ui/dialog/ui-modal';
import { UiBadge, type UiBadgeTone } from '../../../ui/feedback/ui-badge';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiUser } from '../../../ui/user/ui-user';
import { RadialActionDialog } from '../../../pages/design/radial-menu/radial-action-dialog';
import type { RadialActionDialogData } from '../../../pages/design/radial-menu/radial-action-dialog';
import {
  CALL_RADIAL_LAYOUT,
  type RadialAction,
} from '../../../pages/design/radial-menu/radial-menu.types';
import {
  CloseStatusDialog,
  type CloseStatusResult,
  ContractStatusDialog,
  type ContractStatusDialogData,
  type ContractStatusResult,
  TextActivityDialog,
  type TextActivityDialogData,
} from './lead-activity-dialogs';

const CALL_ACTIONS: readonly Omit<RadialAction<CallStatus>, 'label' | 'tone'>[] = [
  { id: 'reached', icon: 'check_circle' },
  { id: 'no_answer', icon: 'phone_missed' },
  { id: 'callback_requested', icon: 'schedule' },
];

type SelectableClientStatus = Exclude<ClientStatus, 'new_lead'>;

const CLIENT_STATUS_ACTIONS: readonly Omit<
  RadialAction<SelectableClientStatus>,
  'label' | 'tone'
>[] = [
  { id: 'showroom_invited', icon: 'calendar_month' },
  { id: 'calculation_in_progress', icon: 'automation' },
  { id: 'thinking', icon: 'schedule' },
  { id: 'closed_lost', icon: 'close' },
  { id: 'contract_signed', icon: 'check_circle' },
];

const NO_MANAGER_VALUE = '__unassigned__';

@Component({
  selector: 'app-lead-detail-page',
  imports: [RouterLink, UiBadge, UiButton, UiIcon, UiModal, UiSelect, UiUser],
  templateUrl: './lead-detail-page.html',
  styleUrl: './lead-detail-page.scss',
})
export class LeadDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly leadsService = inject(LeadsService);
  private readonly activities = inject(LeadActivitiesService);
  private readonly usersService = inject(UsersService);
  private readonly dialog = inject(UiDialogService);
  protected readonly i18n = inject(I18nService);
  private readonly leadId = signal(this.route.snapshot.paramMap.get('leadId') ?? '');

  protected readonly actionPending = signal(false);
  protected readonly actionError = signal('');
  protected readonly assignManagerDialogOpen = signal(false);
  protected readonly assignManagerId = signal(NO_MANAGER_VALUE);
  protected readonly managerPending = signal(false);
  protected readonly managerError = signal('');
  protected readonly leadResource = resource({
    params: () => this.leadId(),
    loader: ({ params }) => this.leadsService.getById(params),
  });
  protected readonly employeesResource = resource({
    loader: () => this.usersService.listManagers(),
  });
  protected readonly lead = computed(() => this.leadResource.value() ?? null);
  protected readonly loadError = computed(() => {
    const error = this.leadResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });
  protected readonly timelineEvents = computed(() => this.lead()?.events ?? []);

  protected readonly callTone = callStatusTone;
  protected readonly clientTone = clientStatusTone;
  protected readonly isTerminal = leadIsTerminal;

  protected async openCallMenu(lead: MockLead): Promise<void> {
    const status = await firstValueFrom(
      this.dialog
        .open<RadialActionDialog, RadialActionDialogData<CallStatus>, CallStatus>(
          RadialActionDialog,
          {
            data: {
              title: this.i18n.t('leadDetail.callChoose'),
              hint: this.i18n.t('leadDetail.callHint'),
              actions: CALL_ACTIONS.map((action) => ({
                ...action,
                label: this.i18n.callStatusLabel(action.id),
                tone: callStatusTone(action.id),
              })),
              layout: CALL_RADIAL_LAYOUT,
            },
            panelClass: 'radial-menu-dialog-panel',
            backdropClass: 'radial-menu-backdrop',
            ariaLabel: this.i18n.t('leadDetail.callChoose'),
            maxWidth: '100vw',
            enterAnimationDuration: 0,
            exitAnimationDuration: 0,
          },
        )
        .afterClosed(),
    );
    if (!status) return;
    let comment = '';
    if (status === 'reached') {
      const result = await this.openTextDialog({
        eyebrow: this.i18n.t('leadDetail.reachedEyebrow'),
        title: this.i18n.t('leadDetail.reachedTitle'),
        description: this.i18n.t('leadDetail.reachedDescription'),
        placeholder: this.i18n.t('leadDetail.reachedPlaceholder'),
        submitLabel: this.i18n.t('leadDetail.saveCall'),
        commentOptional: isSuperAdminRole(this.auth.profile()?.role),
      });
      if (result === undefined) return;
      comment = result;
    }
    await this.runActivity(() => this.activities.recordCall(lead.id, status, comment));
  }

  protected async openClientStatusMenu(lead: MockLead): Promise<void> {
    const status = await firstValueFrom(
      this.dialog
        .open<
          RadialActionDialog,
          RadialActionDialogData<SelectableClientStatus>,
          SelectableClientStatus
        >(RadialActionDialog, {
          data: {
            title: this.i18n.t('leadDetail.statusChoose'),
            hint: this.i18n.t('leadDetail.statusHint'),
            actions: CLIENT_STATUS_ACTIONS.map((action) => ({
              ...action,
              label: this.clientStatusLabel(action.id),
              tone: clientStatusTone(action.id),
              disabled: action.id === lead.clientStatus,
            })),
            layout: { buttonAppearance: 'tone' },
          },
          panelClass: 'radial-menu-dialog-panel',
          backdropClass: 'radial-menu-backdrop',
          ariaLabel: this.i18n.t('leadDetail.statusChoose'),
          maxWidth: '100vw',
          enterAnimationDuration: 0,
          exitAnimationDuration: 0,
        })
        .afterClosed(),
    );
    if (!status) return;
    await this.selectClientStatus(lead, status);
  }

  protected async openComment(lead: MockLead): Promise<void> {
    const comment = await this.openTextDialog({
      eyebrow: this.i18n.t('leadDetail.noteEyebrow'),
      title: this.i18n.t('leadDetail.addComment'),
      description: this.i18n.t('leadDetail.commentDescription'),
      placeholder: this.i18n.t('leadDetail.commentPlaceholder'),
      submitLabel: this.i18n.t('leadDetail.addTimeline'),
    });
    if (!comment) return;
    await this.runActivity(() => this.activities.addComment(lead.id, comment));
  }

  private async selectClientStatus(lead: MockLead, status: SelectableClientStatus): Promise<void> {
    if (status === lead.clientStatus) return;
    if (status === 'closed_lost') {
      const result = await firstValueFrom(
        this.dialog
          .open<CloseStatusDialog, never, CloseStatusResult>(CloseStatusDialog, {
            ariaLabelledBy: 'close-status-title',
            maxWidth: 'calc(100vw - 1rem)',
          })
          .afterClosed(),
      );
      if (!result) return;
      await this.runActivity(() =>
        this.activities.closeLead(lead.id, result.reason, result.comment),
      );
      return;
    }
    if (status === 'contract_signed') {
      const result = await firstValueFrom(
        this.dialog
          .open<ContractStatusDialog, ContractStatusDialogData, ContractStatusResult>(
            ContractStatusDialog,
            {
              data: { defaultCurrency: defaultCurrencyForOffice(lead.officeCode) },
              ariaLabelledBy: 'contract-status-title',
              maxWidth: 'calc(100vw - 1rem)',
            },
          )
          .afterClosed(),
      );
      if (!result) return;
      await this.runActivity(() =>
        this.activities.signContract(
          lead.id,
          result.contractNumber,
          result.amount,
          result.currency,
        ),
      );
      return;
    }
    await this.runActivity(() => this.activities.setClientStatus(lead.id, status));
  }

  protected async reopenLead(lead: MockLead): Promise<void> {
    await this.runActivity(() => this.activities.reopen(lead.id));
  }

  protected canAssignManager(lead: MockLead): boolean {
    return !lead.archivedAt && isSuperAdminRole(this.auth.profile()?.role);
  }

  protected managerActionLabel(lead: MockLead): string {
    return this.i18n.t(lead.assignedToId ? 'lead.replaceManager' : 'lead.assignManager');
  }

  protected managerOptions(lead: MockLead): readonly UiSelectOption[] {
    const managers = (this.employeesResource.value() ?? [])
      .filter(
        (employee) =>
          employee.status === 'active' &&
          employee.role !== 'super_admin' &&
          employee.officeIds.includes(lead.officeCode),
      )
      .map((employee) => ({
        value: employee.id,
        label: employee.displayName,
        userId: employee.id,
      }));

    return [{ value: NO_MANAGER_VALUE, label: this.i18n.t('common.unassigned') }, ...managers];
  }

  protected openAssignManagerDialog(lead: MockLead): void {
    if (!this.canAssignManager(lead)) return;
    this.managerError.set('');
    this.assignManagerId.set(lead.assignedToId ?? NO_MANAGER_VALUE);
    this.assignManagerDialogOpen.set(true);
  }

  protected closeAssignManagerDialog(): void {
    if (this.managerPending()) return;
    this.managerError.set('');
    this.assignManagerDialogOpen.set(false);
  }

  protected async submitAssignManager(lead: MockLead): Promise<void> {
    if (this.managerPending()) return;
    this.managerError.set('');
    if (!this.canAssignManager(lead)) {
      this.managerError.set(this.i18n.t('lead.editForbidden'));
      return;
    }

    const assignedToId =
      this.assignManagerId() === NO_MANAGER_VALUE ? null : this.assignManagerId();
    if ((lead.assignedToId ?? null) === assignedToId) {
      this.assignManagerDialogOpen.set(false);
      return;
    }

    this.managerPending.set(true);
    try {
      await this.leadsService.updateLeadDetails(
        lead.id,
        {
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          cityRegion: lead.cityRegion,
          productInterest: lead.productInterest,
          estimatedBudget: lead.estimatedBudget,
          initialMessage: lead.initialMessage,
          assignedToId,
        },
        ['manager'],
      );
      this.assignManagerDialogOpen.set(false);
      await this.leadResource.reload();
      await this.employeesResource.reload();
    } catch (error) {
      this.managerError.set(
        error instanceof Error ? error.message : this.i18n.t('lead.saveChangesFailed'),
      );
    } finally {
      this.managerPending.set(false);
    }
  }

  private async openTextDialog(data: TextActivityDialogData): Promise<string | undefined> {
    return firstValueFrom(
      this.dialog
        .open<TextActivityDialog, TextActivityDialogData, string>(TextActivityDialog, {
          data,
          ariaLabelledBy: 'text-activity-title',
          maxWidth: 'calc(100vw - 1rem)',
        })
        .afterClosed(),
    );
  }

  private async runActivity(action: () => Promise<void>): Promise<void> {
    if (this.actionPending()) return;
    this.actionError.set('');
    this.actionPending.set(true);
    try {
      await action();
      await this.leadResource.reload();
      await this.employeesResource.reload();
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'Не вдалося зберегти дію.');
    } finally {
      this.actionPending.set(false);
    }
  }

  protected eventTitle(event: LeadEvent): string {
    return presentEventTitleFromLeadEvent(event, this.i18n.locale());
  }

  protected eventBody(event: LeadEvent): string {
    if (this.eventStatusLabel(event)) return event.comment?.trim() ?? '';
    return presentEventBodyFromLeadEvent(event, this.i18n.locale());
  }

  protected eventStatusLabel(event: LeadEvent): string {
    if (!event.statusCode) return '';
    if (event.category === 'call_status') {
      return this.isCallStatus(event.statusCode)
        ? this.callStatusLabel(event.statusCode)
        : event.statusCode;
    }
    if (event.category === 'client_status' || event.category === 'system') {
      return this.isClientStatus(event.statusCode)
        ? this.clientStatusLabel(event.statusCode)
        : event.statusCode;
    }
    return '';
  }

  protected eventStatusTone(event: LeadEvent): UiBadgeTone {
    if (event.category === 'call_status' && this.isCallStatus(event.statusCode)) {
      return callStatusTone(event.statusCode);
    }
    if (
      (event.category === 'client_status' || event.category === 'system') &&
      this.isClientStatus(event.statusCode)
    ) {
      return clientStatusTone(event.statusCode);
    }
    return 'neutral';
  }

  protected eventActorName(event: LeadEvent): string {
    return event.actorName?.trim() || this.employeeName(event.actorId || null);
  }

  private isCallStatus(value: string | null | undefined): value is CallStatus {
    return value === 'reached' || value === 'no_answer' || value === 'callback_requested';
  }

  private isClientStatus(value: string | null | undefined): value is ClientStatus {
    return (
      value === 'new_lead' ||
      value === 'showroom_invited' ||
      value === 'calculation_in_progress' ||
      value === 'thinking' ||
      value === 'closed_lost' ||
      value === 'contract_signed'
    );
  }

  protected employeeName(id: string | null): string {
    if (!id) return this.i18n.t('common.unassigned');
    return (
      this.employeesResource.value()?.find((employee) => employee.id === id)?.displayName ??
      this.i18n.t('common.unknown')
    );
  }

  protected callStatusLabel(status: CallStatus): string {
    return this.i18n.callStatusLabel(status);
  }

  protected clientStatusLabel(status: ClientStatus): string {
    return this.i18n.clientStatusLabel(status);
  }

  protected sourceLabel(lead: MockLead): string {
    return this.i18n.sourceLabel(lead.source);
  }

  protected officeName(code: string): string {
    return this.i18n.officeFilterLabel(code);
  }

  protected closeReasonLabel(code: string): string {
    return this.i18n.closeReasonLabel(code);
  }

  protected defaultCurrency(lead: MockLead): string {
    return defaultCurrencyForOffice(lead.officeCode);
  }

  protected formatDateTime(value: string | null | undefined): string {
    return this.i18n.formatDateTime(value);
  }

  protected formatMoney(value: number | null | undefined, currency: string): string {
    return this.i18n.formatMoney(value, currency);
  }
}
