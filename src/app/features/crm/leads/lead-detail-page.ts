import { Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { I18nService } from '@core/i18n/i18n.service';
import { officeTimeZone } from '@core/office/office.config';
import * as leadPolicy from '@core/policy/lead.policy';
import { isSuperAdminRole } from '@core/roles/roles';
import { SessionService } from '@core/session/session.service';
import {
  activeRemindersForLead,
  leadIsTerminal,
  showroomDueAtForLead,
  type LeadActiveReminder,
} from '@domain/lead.rules';
import type { LeadEvent, LeadMarkerKind, Lead } from '@domain/lead.types';
import { LeadActivitiesService } from '@services/lead-activities.service';
import { LeadsService } from '@services/leads.service';
import { UsersService } from '@services/users.service';
import {
  addCalendarDays,
  AppointmentsService,
  calendarAppointmentDeepLink,
  type CalendarAppointmentDeepLink,
  officeDateKey,
} from '@services/appointments.service';
import { UiButton } from '@ui/button/ui-button';
import { UiDialogService } from '@ui/dialog/ui-dialog';
import { UiModal } from '@ui/dialog/ui-modal';
import { UiSelect, type UiSelectOption } from '@ui/form/ui-select';
import { UiIcon } from '@ui/icon/ui-icon';
import * as presenter from './lead-detail-page.presenter';
import { LeadActionsPanel } from './lead-actions-panel';
import { LeadMarkerToggles } from './lead-marker-toggles';
import { LeadSummaryPanel } from './lead-summary-panel';
import { LeadTimeline } from './lead-timeline';
import {
  TextActivityDialog,
  type TextActivityDialogData,
  type TextActivityDialogResult,
} from './lead-activity-dialogs';
import { EditLeadDialog } from './edit-lead-dialog';
import {
  AppointmentDrawer,
  type AppointmentDrawerData,
  type AppointmentDrawerResult,
} from '@features/crm/calendar/appointment-drawer';

const NO_MANAGER_VALUE = '__unassigned__';

@Component({
  selector: 'app-lead-detail-view',
  imports: [
    RouterLink,
    EditLeadDialog,
    LeadActionsPanel,
    LeadMarkerToggles,
    LeadSummaryPanel,
    LeadTimeline,
    UiButton,
    UiIcon,
    UiModal,
    UiSelect,
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

  private leadPolicyContext(): leadPolicy.LeadPolicyContext {
    return {
      permissions: this.auth.me()?.permissions,
      isSuperAdmin: this.session.officeContext()?.isSuperAdmin ?? false,
      userOffices: this.session.officeContext()?.userOffices ?? [],
      userId: this.auth.sessionContext()?.user.id ?? null,
    };
  }

  protected canMutateEvent(event: LeadEvent): boolean {
    return leadPolicy.canMutateEvent(this.leadPolicyContext(), event);
  }

  /** Bound field (not a method reference) so `LeadTimeline` can call it detached from `this`. */
  protected readonly canMutateEventFn = (event: LeadEvent): boolean => this.canMutateEvent(event);

  /** Bound field (not a method reference) so `LeadTimeline` can call it detached from `this`. */
  protected readonly employeeNameFn = (id: string | null): string => this.employeeName(id);

  protected readonly activeReminders = computed(() => {
    const lead = this.lead();
    return lead ? activeRemindersForLead(lead) : [];
  });

  protected readonly isTerminal = leadIsTerminal;

  protected async editEvent(lead: Lead, event: LeadEvent): Promise<void> {
    if (!this.canMutateEvent(event)) return;
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

  protected async deleteTimelineEvent(lead: Lead, event: LeadEvent): Promise<void> {
    await this.runActivity(() => this.leadsService.deleteHistoryEvent(lead.id, event.id));
  }

  protected translateEventFor(lead: Lead): (event: LeadEvent) => Promise<void> {
    return async (event) => {
      await this.leadsService.translateHistoryEvent(lead.id, event.id);
      await this.leadResource.reload();
      this.changed.emit();
    };
  }

  protected async clearReminder(lead: Lead, reminder: LeadActiveReminder): Promise<void> {
    if (lead.archivedAt || this.isTerminal(lead)) return;
    await this.runActivity(() => this.activities.clearReminder(lead.id, reminder.kind));
  }

  protected async reopenLead(lead: Lead): Promise<void> {
    await this.runActivity(() => this.activities.reopen(lead.id));
  }

  protected openLeadEditDialog(lead: Lead): void {
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

  protected canEditLead(lead: Lead): boolean {
    return leadPolicy.canEditLead(this.leadPolicyContext(), lead);
  }

  protected canArchiveLead(lead: Lead): boolean {
    return leadPolicy.canArchiveLead(this.leadPolicyContext(), lead);
  }

  protected canManageArchivedLead(lead: Lead): boolean {
    return leadPolicy.canManageArchivedLead(this.leadPolicyContext(), lead);
  }

  protected async confirmArchiveLead(lead: Lead): Promise<void> {
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

  protected async restoreLead(lead: Lead): Promise<void> {
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

  protected async confirmDeleteLead(lead: Lead): Promise<void> {
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

  protected async toggleMarker(lead: Lead, kind: LeadMarkerKind): Promise<void> {
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

  protected canAssignManager(lead: Lead): boolean {
    return !lead.archivedAt && isSuperAdminRole(this.auth.profile()?.role);
  }

  protected managerOptions(lead: Lead): readonly UiSelectOption[] {
    return presenter.activeOfficeStaffOptions(
      this.employeesResource.value() ?? [],
      lead.officeCode,
      isSuperAdminRole,
      { value: NO_MANAGER_VALUE, label: this.i18n.t('common.unassigned') },
    );
  }

  protected openAssignManagerDialog(lead: Lead): void {
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

  protected async submitAssignManager(lead: Lead): Promise<void> {
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
        lead.version ?? 1,
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

  protected async openLeadAppointment(lead: Lead): Promise<void> {
    const office = (this.session.officeContext()?.filterOffices ?? []).find(
      (item) => item.code === lead.officeCode,
    );
    if (!office) {
      this.actionError.set(this.i18n.t('calendar.officeUnavailable'));
      return;
    }
    const timeZone = office.timezone_name ?? officeTimeZone(office.code);
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

  protected async runActivity(action: () => Promise<void>): Promise<void> {
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

  /** Bound field so `LeadActionsPanel` can invoke it detached from `this`. */
  protected readonly runActivityFn = (action: () => Promise<void>): Promise<void> =>
    this.runActivity(action);

  protected employeeName(id: string | null): string {
    if (!id) return this.i18n.t('common.unassigned');
    return (
      this.employeesResource.value()?.find((employee) => employee.id === id)?.displayName ??
      this.i18n.t('common.unknown')
    );
  }

  protected calendarAppointmentQueryParams(lead: Lead): CalendarAppointmentDeepLink | null {
    const showroomDueAt = showroomDueAtForLead(lead);
    if (!showroomDueAt) return null;
    const office = (this.session.officeContext()?.filterOffices ?? []).find(
      (item) => item.code === lead.officeCode,
    );
    if (!office) return null;
    const timeZone = office.timezone_name ?? officeTimeZone(office.code);
    return calendarAppointmentDeepLink({
      leadId: lead.id,
      showroomDueAt,
      officeId: office.id,
      timeZone,
    });
  }
}
