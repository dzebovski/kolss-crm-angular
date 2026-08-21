import { Component, inject, input, output } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { I18nService } from '@core/i18n/i18n.service';
import { SessionService } from '@core/session/session.service';
import { isSuperAdminRole } from '@core/roles/roles';
import {
  callStatusTone,
  clientStatusTone,
  defaultCurrencyForOffice,
  leadIsTerminal,
} from '@domain/lead.rules';
import type { AppointmentKind } from '@core/api/generated/kolss-api.types';
import type { CallStatus, ClientStatus, Lead } from '@domain/lead.types';
import { LeadActivitiesService } from '@services/lead-activities.service';
import { UiButton } from '@ui/button/ui-button';
import { UiDialogService } from '@ui/dialog/ui-dialog';
import { UiIcon } from '@ui/icon/ui-icon';
import type { UiSelectOption } from '@ui/form/ui-select';
import { RadialActionDialog } from '@ui/radial/radial-action-dialog';
import type { RadialActionDialogData } from '@ui/radial/radial-action-dialog';
import {
  CALL_RADIAL_LAYOUT,
  type RadialAction,
  type RadialLayoutConfig,
} from '@ui/radial/radial-menu.types';
import type { CrmEmployee } from '@services/users.service';
import * as presenter from './lead-detail-page.presenter';
import {
  CloseStatusDialog,
  type CloseStatusResult,
  ContractStatusDialog,
  type ContractStatusDialogData,
  type ContractStatusResult,
  DueDateDialog,
  type DueDateDialogData,
  TextActivityDialog,
  type TextActivityDialogData,
  type TextActivityDialogResult,
} from './lead-activity-dialogs';

const CALL_ACTIONS: readonly Omit<RadialAction<CallStatus>, 'label' | 'tone'>[] = [
  { id: 'reached', icon: 'check_circle' },
  { id: 'no_answer', icon: 'phone_missed' },
  { id: 'callback_requested', icon: 'schedule' },
];

type SelectableClientStatus = Exclude<ClientStatus, 'new_lead'>;

/**
 * Statuses that own a calendar appointment: they are never set directly, they
 * open the appointment drawer, and re-selecting the current one reschedules.
 */
const APPOINTMENT_KIND_BY_STATUS = {
  showroom_invited: 'showroom',
  measurement_scheduled: 'measurement',
} as const satisfies Partial<Record<SelectableClientStatus, AppointmentKind>>;

type AppointmentClientStatus = keyof typeof APPOINTMENT_KIND_BY_STATUS;

function isAppointmentStatus(status: ClientStatus): status is AppointmentClientStatus {
  return status in APPOINTMENT_KIND_BY_STATUS;
}

const CLIENT_STATUS_ACTIONS: readonly Omit<
  RadialAction<SelectableClientStatus>,
  'label' | 'tone'
>[] = [
  { id: 'showroom_invited', icon: 'calendar_month' },
  { id: 'measurement_scheduled', icon: 'straighten' },
  { id: 'calculation_in_progress', icon: 'automation' },
  { id: 'thinking', icon: 'schedule' },
  { id: 'postponed', icon: 'history' },
  { id: 'closed_lost', icon: 'close' },
  { id: 'contract_signed', icon: 'check_circle' },
];

/** Seven actions, spread evenly (360 / 7 ≈ 51.43°) around the same starting anchor the six-action layout used. */
const CLIENT_STATUS_RADIAL_LAYOUT: RadialLayoutConfig<SelectableClientStatus> = {
  buttonAppearance: 'tone',
  anglesByActionId: {
    calculation_in_progress: -150,
    showroom_invited: -98.57,
    measurement_scheduled: -47.14,
    contract_signed: 4.29,
    thinking: 55.71,
    postponed: 107.14,
    closed_lost: 158.57,
  },
};

/**
 * Everything a manager can *do* with an in-progress or just-closed lead:
 * record a call, change client status, add a comment, and (once terminal)
 * reopen/archive/restore/delete it. Presentational in the sense that the
 * mutation itself always runs through the caller-supplied `runActivity`
 * (which owns pending/error state and reload/`changed` semantics on
 * `LeadDetailView`) — this component never touches `LeadsService` or the
 * lead resource directly, and the four archive/restore/delete/reopen
 * confirmations stay on `LeadDetailView` (they're covered by direct-call
 * tests there), reached here only via output.
 */
@Component({
  selector: 'app-lead-actions-panel',
  imports: [UiButton, UiIcon],
  templateUrl: './lead-actions-panel.html',
  styleUrl: './lead-actions-panel.scss',
})
export class LeadActionsPanel {
  private readonly dialog = inject(UiDialogService);
  private readonly activities = inject(LeadActivitiesService);
  private readonly session = inject(SessionService);
  protected readonly i18n = inject(I18nService);

  readonly lead = input.required<Lead>();
  readonly employees = input<readonly CrmEmployee[]>([]);
  readonly pending = input(false);
  readonly deletingLead = input(false);
  readonly canArchiveLead = input(false);
  readonly canManageArchivedLead = input(false);
  readonly runActivity = input.required<(action: () => Promise<void>) => Promise<void>>();

  readonly reopenRequested = output<void>();
  readonly restoreRequested = output<void>();
  readonly archiveRequested = output<void>();
  readonly deletePermanentlyRequested = output<void>();
  readonly appointmentRequested = output<AppointmentKind>();

  protected readonly isTerminal = leadIsTerminal;

  protected closeSummaryLine(lead: Lead): string {
    return presenter.closeSummaryLine(lead, this.i18n.clientStatusLabel('closed_lost'), (code) =>
      this.i18n.closeReasonLabel(code),
    );
  }

  protected defaultCurrency(lead: Lead): string {
    return defaultCurrencyForOffice(lead.officeCode);
  }

  protected formatMoney(value: number, currency: string): string {
    return this.i18n.formatMoney(value, currency);
  }

  protected async openCallMenu(): Promise<void> {
    const lead = this.lead();
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
        commentOptional: this.session.officeContext()?.isSuperAdmin ?? false,
      });
      if (result === undefined) return;
      comment = result.comment;
    } else if (status === 'callback_requested') {
      const dueDate = await this.openDueDateDialog(this.i18n.callStatusLabel(status));
      if (!dueDate) return;
      await this.runActivity()(() => this.activities.recordCall(lead.id, status, comment, dueDate));
      return;
    }
    await this.runActivity()(() => this.activities.recordCall(lead.id, status, comment));
  }

  protected async openClientStatusMenu(): Promise<void> {
    const lead = this.lead();
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
              label: this.i18n.clientStatusLabel(action.id),
              tone: clientStatusTone(action.id),
              disabled: action.id === lead.clientStatus && !isAppointmentStatus(action.id),
            })),
            layout: CLIENT_STATUS_RADIAL_LAYOUT,
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

  protected async openComment(): Promise<void> {
    const lead = this.lead();
    const result = await this.openTextDialog({
      eyebrow: this.i18n.t('leadDetail.noteEyebrow'),
      title: this.i18n.t('leadDetail.addComment'),
      description: this.i18n.t('leadDetail.commentDescription'),
      placeholder: this.i18n.t('leadDetail.commentPlaceholder'),
      submitLabel: this.i18n.t('leadDetail.addTimeline'),
      allowDueDate: true,
      allowManager: true,
      managerOptions: this.commentAssigneeOptions(lead),
    });
    if (!result) return;
    await this.runActivity()(() =>
      this.activities.addComment(
        lead.id,
        result.comment,
        result.dueDate ?? '',
        result.assignedTo ?? '',
      ),
    );
  }

  /** Active, non–super_admin staff of the lead's office, offered as task assignees. */
  private commentAssigneeOptions(lead: Lead): readonly UiSelectOption[] {
    return presenter.activeOfficeStaffOptions(this.employees(), lead.officeCode, isSuperAdminRole, {
      value: '',
      label: this.i18n.t('common.unassigned'),
    });
  }

  private async selectClientStatus(lead: Lead, status: SelectableClientStatus): Promise<void> {
    if (status === lead.clientStatus && !isAppointmentStatus(status)) return;
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
      await this.runActivity()(() =>
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
      await this.runActivity()(() =>
        this.activities.signContract(
          lead.id,
          result.contractNumber,
          result.amount,
          result.currency,
        ),
      );
      return;
    }
    if (isAppointmentStatus(status)) {
      this.appointmentRequested.emit(APPOINTMENT_KIND_BY_STATUS[status]);
      return;
    }
    if (status === 'thinking') {
      const result = await this.openTextDialog({
        eyebrow: this.i18n.clientStatusLabel(status),
        title: this.i18n.t('leadDetail.thinkingTitle'),
        description: this.i18n.t('leadDetail.thinkingDescription'),
        placeholder: this.i18n.t('leadDetail.commentPlaceholder'),
        submitLabel: this.i18n.t('common.save'),
        commentOptional: true,
        allowDueDate: true,
      });
      if (result === undefined) return;
      await this.runActivity()(() =>
        this.activities.setClientStatus(lead.id, status, result.dueDate ?? '', result.comment),
      );
      return;
    }
    if (status === 'postponed') {
      const result = await this.openTextDialog({
        eyebrow: this.i18n.clientStatusLabel(status),
        title: this.i18n.t('leadDetail.postponedTitle'),
        description: this.i18n.t('leadDetail.postponedDescription'),
        placeholder: this.i18n.t('leadDetail.commentPlaceholder'),
        submitLabel: this.i18n.t('common.save'),
        allowDueDate: true,
      });
      if (result === undefined) return;
      await this.runActivity()(() =>
        this.activities.setClientStatus(lead.id, status, result.dueDate ?? '', result.comment),
      );
      return;
    }
    await this.runActivity()(() => this.activities.setClientStatus(lead.id, status));
  }

  private async openTextDialog(
    data: TextActivityDialogData,
  ): Promise<TextActivityDialogResult | undefined> {
    return firstValueFrom(
      this.dialog
        .open<TextActivityDialog, TextActivityDialogData, TextActivityDialogResult>(
          TextActivityDialog,
          {
            data,
            ariaLabelledBy: 'text-activity-title',
            maxWidth: 'calc(100vw - 1rem)',
          },
        )
        .afterClosed(),
    );
  }

  private async openDueDateDialog(
    statusLabel: string,
    options: Pick<DueDateDialogData, 'required' | 'initialDate'> = {},
  ): Promise<string | undefined> {
    return firstValueFrom(
      this.dialog
        .open<DueDateDialog, DueDateDialogData, string>(DueDateDialog, {
          data: { statusLabel, ...options },
          ariaLabelledBy: 'due-date-title',
          maxWidth: 'calc(100vw - 1rem)',
        })
        .afterClosed(),
    );
  }
}
