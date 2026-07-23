import { Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { KolssApiError } from '../../../core/api/generated/kolss-api.client';
import {
  presentEventBodyFromLeadEvent,
  presentEventTitleFromLeadEvent,
  presentHistoryAuditText,
} from '../../../core/i18n/event-presenter';
import { I18nService } from '../../../core/i18n/i18n.service';
import { canEditLeads, isSuperAdminRole } from '../../../core/roles/roles';
import { SessionService } from '../../../core/session/session.service';
import {
  callStatusTone,
  callbackDueAtFromNewValue,
  clientStatusTone,
  clientStatusToneForLead,
  defaultCurrencyForOffice,
  leadIsInWork,
  leadIsTerminal,
  showroomDueAtForLead,
} from '../../../services/crm-mock.helpers';
import type {
  CallStatus,
  ClientStatus,
  LeadEvent,
  LeadMarkerKind,
  MockLead,
} from '../../../services/crm-mock.types';
import { LeadActivitiesService } from '../../../services/lead-activities.service';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import {
  addCalendarDays,
  AppointmentsService,
  officeDateKey,
} from '../../../services/appointments.service';
import { UiButton } from '../../../ui/button/ui-button';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { UiModal } from '../../../ui/dialog/ui-modal';
import { UiBadge, type UiBadgeTone } from '../../../ui/feedback/ui-badge';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { LinkifiedText } from '../../../ui/text/linkified-text';
import { UiUser } from '../../../ui/user/ui-user';
import { LeadDueDate, type LeadDueDateKind } from './lead-due-date';
import { LeadMarkerToggles } from './lead-marker-toggles';
import { RadialActionDialog } from '../../../pages/design/radial-menu/radial-action-dialog';
import type { RadialActionDialogData } from '../../../pages/design/radial-menu/radial-action-dialog';
import {
  CALL_RADIAL_LAYOUT,
  type RadialAction,
  type RadialLayoutConfig,
} from '../../../pages/design/radial-menu/radial-menu.types';
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
import { EditLeadDialog } from './edit-lead-dialog';
import {
  AppointmentDrawer,
  type AppointmentDrawerData,
  type AppointmentDrawerResult,
} from '../calendar/appointment-drawer';

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

const CLIENT_STATUS_RADIAL_LAYOUT: RadialLayoutConfig<SelectableClientStatus> = {
  buttonAppearance: 'tone',
  anglesByActionId: {
    calculation_in_progress: -126,
    showroom_invited: -54,
    contract_signed: 18,
    thinking: 90,
    closed_lost: 162,
  },
};

const NO_MANAGER_VALUE = '__unassigned__';

@Component({
  selector: 'app-lead-detail-view',
  imports: [
    RouterLink,
    EditLeadDialog,
    LeadDueDate,
    LeadMarkerToggles,
    LinkifiedText,
    UiBadge,
    UiButton,
    UiIcon,
    UiModal,
    UiSelect,
    UiUser,
  ],
  templateUrl: './lead-detail-page.html',
  styleUrl: './lead-detail-page.scss',
})
export class LeadDetailView {
  private readonly auth = inject(AuthService);
  private readonly leadsService = inject(LeadsService);
  private readonly activities = inject(LeadActivitiesService);
  private readonly usersService = inject(UsersService);
  private readonly appointments = inject(AppointmentsService);
  private readonly dialog = inject(UiDialogService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  protected readonly i18n = inject(I18nService);
  readonly leadId = input.required<string>();
  readonly displayMode = input<'page' | 'drawer'>('page');
  readonly changed = output<void>();

  protected readonly actionPending = signal(false);
  protected readonly actionError = signal('');
  protected readonly editLeadDialogOpen = signal(false);
  protected readonly deletingLead = signal(false);
  protected readonly markerPending = signal<LeadMarkerKind | null>(null);
  protected readonly markerError = signal('');
  protected readonly assignManagerDialogOpen = signal(false);
  protected readonly assignManagerId = signal(NO_MANAGER_VALUE);
  protected readonly managerPending = signal(false);
  protected readonly managerError = signal('');
  protected readonly deleteEventTarget = signal<LeadEvent | null>(null);
  protected readonly translationPendingEventIds = signal<ReadonlySet<string>>(new Set());
  protected readonly translationErrors = signal<Readonly<Record<string, string>>>({});
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
  protected readonly canEditTimeline = computed(() => isSuperAdminRole(this.auth.profile()?.role));

  protected readonly callTone = callStatusTone;
  protected readonly clientTone = clientStatusTone;
  protected readonly clientToneForLead = clientStatusToneForLead;
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
      comment = result.comment;
    } else if (status === 'callback_requested') {
      const dueDate = await this.openDueDateDialog(this.callStatusLabel(status));
      if (!dueDate) return;
      await this.runActivity(() => this.activities.recordCall(lead.id, status, comment, dueDate));
      return;
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
              disabled: action.id === lead.clientStatus && action.id !== 'showroom_invited',
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

  protected async openComment(lead: MockLead): Promise<void> {
    const result = await this.openTextDialog({
      eyebrow: this.i18n.t('leadDetail.noteEyebrow'),
      title: this.i18n.t('leadDetail.addComment'),
      description: this.i18n.t('leadDetail.commentDescription'),
      placeholder: this.i18n.t('leadDetail.commentPlaceholder'),
      submitLabel: this.i18n.t('leadDetail.addTimeline'),
      allowDueDate: true,
    });
    if (!result) return;
    await this.runActivity(() =>
      this.activities.addComment(lead.id, result.comment, result.dueDate ?? ''),
    );
  }

  protected async editEvent(lead: MockLead, event: LeadEvent): Promise<void> {
    if (!this.canEditTimeline()) return;
    const result = await this.openTextDialog({
      eyebrow: this.i18n.t('leadDetail.history'),
      title: this.i18n.t('lead.editHistory'),
      description: this.i18n.t('lead.editHistoryHint'),
      placeholder: this.i18n.t('leadDetail.commentPlaceholder'),
      submitLabel: this.i18n.t('common.save'),
      commentOptional: true,
      initialValue: event.comment ?? '',
    });
    if (result === undefined) return;
    if (result.comment === (event.comment ?? '').trim()) return;
    await this.runActivity(async () => {
      await this.leadsService.updateHistoryEvent(lead.id, event.id, { comment: result.comment });
    });
  }

  protected askDeleteEvent(event: LeadEvent): void {
    if (!this.canEditTimeline()) return;
    this.deleteEventTarget.set(event);
  }

  protected isEventTranslationPending(eventId: string): boolean {
    return this.translationPendingEventIds().has(eventId);
  }

  protected translationError(eventId: string): string {
    return this.translationErrors()[eventId] ?? '';
  }

  protected async translateEvent(lead: MockLead, event: LeadEvent): Promise<void> {
    if (this.isEventTranslationPending(event.id) || !event.comment?.trim() || event.translationEn) {
      return;
    }
    this.clearTranslationError(event.id);
    this.translationPendingEventIds.update((ids) => new Set(ids).add(event.id));
    try {
      await this.leadsService.translateHistoryEvent(lead.id, event.id);
      await this.leadResource.reload();
      this.changed.emit();
    } catch {
      this.translationErrors.update((errors) => ({
        ...errors,
        [event.id]: this.i18n.t('leadDetail.translationFailed'),
      }));
    } finally {
      this.translationPendingEventIds.update((ids) => {
        const next = new Set(ids);
        next.delete(event.id);
        return next;
      });
    }
  }

  private clearTranslationError(eventId: string): void {
    this.translationErrors.update((errors) => {
      if (!(eventId in errors)) return errors;
      const next = { ...errors };
      delete next[eventId];
      return next;
    });
  }

  protected cancelDeleteEvent(): void {
    if (this.actionPending()) return;
    this.deleteEventTarget.set(null);
  }

  protected async confirmDeleteEvent(lead: MockLead): Promise<void> {
    const target = this.deleteEventTarget();
    if (!target || !this.canEditTimeline()) return;
    await this.runActivity(() => this.leadsService.deleteHistoryEvent(lead.id, target.id));
    this.deleteEventTarget.set(null);
  }

  private async selectClientStatus(lead: MockLead, status: SelectableClientStatus): Promise<void> {
    if (status === lead.clientStatus && status !== 'showroom_invited') return;
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
    if (status === 'showroom_invited') {
      await this.openLeadAppointment(lead);
      return;
    }
    if (status === 'thinking') {
      const result = await this.openTextDialog({
        eyebrow: this.clientStatusLabel(status),
        title: this.i18n.t('leadDetail.thinkingTitle'),
        description: this.i18n.t('leadDetail.thinkingDescription'),
        placeholder: this.i18n.t('leadDetail.commentPlaceholder'),
        submitLabel: this.i18n.t('common.save'),
        commentOptional: true,
        allowDueDate: true,
      });
      if (result === undefined) return;
      await this.runActivity(() =>
        this.activities.setClientStatus(lead.id, status, result.dueDate ?? '', result.comment),
      );
      return;
    }
    await this.runActivity(() => this.activities.setClientStatus(lead.id, status));
  }

  protected async reopenLead(lead: MockLead): Promise<void> {
    await this.runActivity(() => this.activities.reopen(lead.id));
  }

  protected openLeadEditDialog(lead: MockLead): void {
    if (!this.canEditLead(lead)) return;
    this.actionError.set('');
    this.editLeadDialogOpen.set(true);
  }

  protected closeLeadEditDialog(): void {
    this.editLeadDialogOpen.set(false);
  }

  protected async handleLeadEditSaved(): Promise<void> {
    this.editLeadDialogOpen.set(false);
    try {
      await this.leadResource.reload();
      this.changed.emit();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error.actionFailed';
      this.actionError.set(this.i18n.localizeError(message));
    }
  }

  protected canEditLead(lead: MockLead): boolean {
    if (lead.archivedAt) return false;
    const role = this.auth.profile()?.role;
    if (!canEditLeads(role)) return false;
    if (role === 'super_admin') return true;
    return (
      role === 'office_admin' &&
      (this.session.officeContext()?.userOffices ?? []).some(
        (office) => office.code === lead.officeCode,
      )
    );
  }

  protected canArchiveLead(lead: MockLead): boolean {
    if (lead.clientStatus !== 'closed_lost' || lead.archivedAt) return false;
    return this.canEditLead(lead);
  }

  protected canManageArchivedLead(lead: MockLead): boolean {
    return !!lead.archivedAt && isSuperAdminRole(this.auth.profile()?.role);
  }

  protected async confirmArchiveLead(lead: MockLead): Promise<void> {
    if (!this.canArchiveLead(lead) || this.deletingLead()) return;

    const confirmed = await firstValueFrom(
      this.dialog
        .confirm({
          title: this.i18n.t('lead.archive'),
          description: this.i18n.t('lead.archiveDesc', { name: lead.name }),
          confirmLabel: this.i18n.t('lead.archiveShort'),
          cancelLabel: this.i18n.t('common.cancel'),
          danger: true,
        })
        .afterClosed(),
    );
    if (!confirmed) return;

    this.actionError.set('');
    this.deletingLead.set(true);
    try {
      await this.leadsService.archiveLead(lead.id);
      this.changed.emit();
      await this.router.navigate(['/crm/leads']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error.leadArchiveFailed';
      this.actionError.set(this.i18n.localizeError(message));
    } finally {
      this.deletingLead.set(false);
    }
  }

  protected async restoreLead(lead: MockLead): Promise<void> {
    if (!this.canManageArchivedLead(lead) || this.actionPending()) return;
    this.actionPending.set(true);
    this.actionError.set('');
    try {
      await this.leadsService.restoreLead(lead.id);
      await this.leadResource.reload();
      this.changed.emit();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error.actionFailed';
      this.actionError.set(this.i18n.localizeError(message));
    } finally {
      this.actionPending.set(false);
    }
  }

  protected async confirmDeleteLead(lead: MockLead): Promise<void> {
    if (!this.canManageArchivedLead(lead) || this.deletingLead()) return;

    const confirmed = await firstValueFrom(
      this.dialog
        .confirm({
          title: this.i18n.t('lead.deletePermanentlyTitle'),
          description: this.i18n.t('lead.deletePermanentlyDesc', { name: lead.name }),
          confirmLabel: this.i18n.t('lead.deletePermanently'),
          cancelLabel: this.i18n.t('common.cancel'),
          danger: true,
        })
        .afterClosed(),
    );
    if (!confirmed) return;

    this.actionError.set('');
    this.deletingLead.set(true);
    try {
      await this.leadsService.deleteLeadPermanently(lead.id);
      this.changed.emit();
      await this.router.navigate(['/crm/leads']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error.actionFailed';
      this.actionError.set(this.i18n.localizeError(message));
    } finally {
      this.deletingLead.set(false);
    }
  }

  protected async toggleMarker(lead: MockLead, kind: LeadMarkerKind): Promise<void> {
    if (lead.archivedAt || this.markerPending()) return;
    this.markerError.set('');
    this.markerPending.set(kind);
    const active = lead.markers.some((marker) => marker.kind === kind);
    try {
      const markers = active
        ? lead.markers.filter((marker) => marker.kind !== kind)
        : [...lead.markers, await this.leadsService.setMarker(lead.id, kind)];
      if (active) await this.leadsService.deleteMarker(lead.id, kind);
      this.leadResource.value.update((value) => (value ? { ...value, markers } : value));
      this.changed.emit();
    } catch (error) {
      this.markerError.set(
        error instanceof Error ? error.message : 'Не вдалося зберегти позначку.',
      );
    } finally {
      this.markerPending.set(null);
    }
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
      this.changed.emit();
    } catch (error) {
      this.managerError.set(
        error instanceof Error ? error.message : this.i18n.t('lead.saveChangesFailed'),
      );
    } finally {
      this.managerPending.set(false);
    }
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

  private async openLeadAppointment(lead: MockLead): Promise<void> {
    const office = (this.session.officeContext()?.filterOffices ?? []).find(
      (item) => item.code === lead.officeCode,
    );
    if (!office) {
      this.actionError.set(this.i18n.t('calendar.officeUnavailable'));
      return;
    }
    const timeZone =
      office.timezone_name ?? (office.code === 'warsaw' ? 'Europe/Warsaw' : 'Europe/Kyiv');
    const showroomDueAt = showroomDueAtForLead(lead);
    const date = showroomDueAt
      ? officeDateKey(new Date(showroomDueAt), timeZone)
      : officeDateKey(new Date(), timeZone);
    this.actionPending.set(true);
    this.actionError.set('');
    try {
      const response = await this.appointments.list({
        officeId: office.id,
        from: date,
        to: addCalendarDays(date, 1),
        status: 'scheduled',
      });
      const appointment = response.items.find((item) => item.lead.id === lead.id);
      const result = await firstValueFrom(
        this.dialog
          .open<AppointmentDrawer, AppointmentDrawerData, AppointmentDrawerResult | undefined>(
            AppointmentDrawer,
            {
              data: {
                office: { ...office, timezone_name: timeZone },
                managers: this.employeesResource.value() ?? [],
                lead,
                date,
                appointment,
                appointments: response.items,
              },
              position: { right: '0', top: '0' },
              width: 'min(31rem, 100vw)',
              maxWidth: '100vw',
              height: '100dvh',
              maxHeight: '100dvh',
              panelClass: ['ui-dialog-panel', 'appointment-drawer-panel'],
            },
          )
          .afterClosed(),
      );
      if (result?.kind === 'saved' || result?.kind === 'stale') {
        await this.leadResource.reload();
        this.changed.emit();
      }
    } catch (error) {
      this.actionError.set(
        error instanceof Error ? error.message : this.i18n.t('calendar.loadFailed'),
      );
    } finally {
      this.actionPending.set(false);
    }
  }

  private async runActivity(action: () => Promise<void>): Promise<void> {
    if (this.actionPending()) return;
    this.actionError.set('');
    this.actionPending.set(true);
    try {
      await action();
      await this.leadResource.reload();
      await this.employeesResource.reload();
      this.changed.emit();
    } catch (error) {
      this.actionError.set(
        error instanceof KolssApiError && error.code === 'active_appointment_exists'
          ? this.i18n.t('calendar.activeExists')
          : error instanceof Error
            ? error.message
            : 'Не вдалося зберегти дію.',
      );
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

  protected eventAuditText(event: LeadEvent): string {
    return presentHistoryAuditText(event, this.i18n.locale(), (value) =>
      this.formatDateTime(value),
    );
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

  protected clientStatusLabelForLead(lead: MockLead): string {
    if (leadIsInWork(lead)) {
      return this.i18n.t('workflow.taken');
    }
    return this.clientStatusLabel(lead.clientStatus);
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

  protected closeSummaryLine(lead: MockLead): string {
    if (!lead.close) return '';
    const parts = [
      this.clientStatusLabel('closed_lost'),
      this.closeReasonLabel(lead.close.reason),
      lead.close.comment.trim(),
    ].filter(Boolean);
    return parts.join(' - ');
  }

  protected defaultCurrency(lead: MockLead): string {
    return defaultCurrencyForOffice(lead.officeCode);
  }

  protected formatDateTime(value: string | null | undefined): string {
    return this.i18n.formatDateTime(value);
  }

  protected eventDueDate(
    event: LeadEvent,
  ): { readonly date: string; readonly kind: LeadDueDateKind } | null {
    const date = callbackDueAtFromNewValue(event.newValue);
    if (!date) return null;
    const isComment =
      event.category === 'comment' || event.type === 'comment' || event.type === 'comment_added';
    const isScheduledStatus =
      (event.category === 'call_status' && event.statusCode === 'callback_requested') ||
      (event.category === 'client_status' &&
        (event.statusCode === 'thinking' || event.statusCode === 'showroom_invited'));
    if (!isComment && !isScheduledStatus) return null;
    return { date, kind: isComment ? 'comment' : 'status' };
  }

  protected readonly showroomDueAtForLead = showroomDueAtForLead;

  protected formatMoney(value: number | null | undefined, currency: string): string {
    return this.i18n.formatMoney(value, currency);
  }
}
