import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type {
  DashboardTask,
  ManagerTaskSection as TaskSection,
} from '@core/api/generated/kolss-api.types';
import { AuthService } from '@core/auth/auth.service';
import { I18nService } from '@core/i18n/i18n.service';
import { canManageTasks } from '@core/policy/task.policy';
import { SessionService } from '@core/session/session.service';
import { dashboardManagers } from '@domain/manager-tasks.rules';
import { addCalendarDays, AppointmentsService } from '@services/appointments.service';
import { UsersService, type CrmEmployee } from '@services/users.service';
import { openAppointmentDrawer } from '@features/crm/calendar/appointment-drawer';
import {
  LeadDetailDrawer,
  type LeadDetailDrawerData,
  type LeadDetailDrawerResult,
  type LeadDetailDrawerState,
} from '@features/crm/leads/lead-detail-drawer';
import { UiButton } from '@ui/button/ui-button';
import { UiDialogService } from '@ui/dialog/ui-dialog';
import { UiIcon } from '@ui/icon/ui-icon';
import { UiUser } from '@ui/user/ui-user';
import { ManagerTaskSection } from './manager-task-section';
import { TaskCreateForm } from './task-create-form';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    RouterLinkActive,
    UiButton,
    UiIcon,
    UiUser,
    ManagerTaskSection,
    TaskCreateForm,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  protected readonly i18n = inject(I18nService);
  protected readonly session = inject(SessionService);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly appointments = inject(AppointmentsService);
  private readonly dialogs = inject(UiDialogService);
  protected readonly currentUserId = computed(() => this.auth.me()?.user.id ?? null);
  protected readonly canManage = computed(() => canManageTasks(this.auth.me()?.permissions));
  protected readonly managersResource = resource({
    params: () => ({ userId: this.currentUserId(), officeId: this.session.selectedOfficeId() }),
    loader: () => this.users.listManagers(),
  });
  protected readonly managers = computed(() =>
    dashboardManagers(
      this.managersResource.value() ?? [],
      this.session.selectedOfficeId(),
      this.currentUserId(),
      this.i18n.locale(),
    ),
  );
  protected readonly groups = computed(() => [
    ...this.managers().map((manager) => ({ id: manager.id, name: manager.displayName, manager })),
    { id: 'unassigned', name: this.i18n.t('dashboard.board.unassigned'), manager: null },
  ]);
  private readonly viewScope = computed(
    () => `${this.currentUserId()}:${this.session.selectedOfficeId()}`,
  );
  protected readonly expanded = linkedSignal<Partial<Record<string, boolean>>>(() => {
    this.viewScope();
    return {};
  });
  protected readonly historyOpen = linkedSignal<Partial<Record<string, boolean>>>(() => {
    this.viewScope();
    return {};
  });
  protected readonly createFor = linkedSignal<string | null>(() => {
    this.viewScope();
    return null;
  });
  protected readonly revision = signal(0);
  protected readonly openError = signal('');
  protected readonly opening = signal(false);
  protected readonly activeSections: readonly TaskSection[] = ['important', 'current', 'future'];
  protected readonly historySections = ['done', 'canceled'] as const;

  protected isExpanded(managerId: string): boolean {
    return this.expanded()[managerId] ?? managerId === this.currentUserId();
  }

  protected toggleManager(managerId: string, event: Event): void {
    this.expanded.update((state) => ({
      ...state,
      [managerId]: (event.target as HTMLDetailsElement).open,
    }));
  }

  protected toggleHistory(managerId: string, section: string, event: Event): void {
    this.historyOpen.update((state) => ({
      ...state,
      [`${managerId}:${section}`]: (event.target as HTMLDetailsElement).open,
    }));
  }

  protected officesFor(manager: CrmEmployee) {
    const officeId = this.session.selectedOfficeId();
    return (this.session.officeContext()?.filterOffices ?? []).filter(
      (office) => manager.officeUuids.includes(office.id) && (!officeId || officeId === office.id),
    );
  }

  protected refresh(): void {
    this.revision.update((value) => value + 1);
  }

  protected taskCreated(): void {
    this.createFor.set(null);
    this.refresh();
  }

  protected async openTask(task: DashboardTask): Promise<void> {
    if (this.opening()) return;
    this.opening.set(true);
    this.openError.set('');
    const scrollY = window.scrollY;
    const focusTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scope = this.viewScope();
    try {
      if (task.source === 'appointment') {
        const office = this.session
          .officeContext()
          ?.filterOffices.find((item) => item.id === task.office.id);
        if (!office || !task.localDate) throw new Error('Missing appointment office/date');
        const response = await this.appointments.list({
          officeId: office.id,
          from: task.localDate,
          to: addCalendarDays(task.localDate, 1),
        });
        if (scope !== this.viewScope()) return;
        const appointment = response.items.find((item) => item.id === task.sourceId);
        if (!appointment) {
          this.refresh();
          throw new Error('Appointment changed');
        }
        const result = await firstValueFrom(
          openAppointmentDrawer(this.dialogs, {
            office,
            appointment,
            managers: this.managersResource.value() ?? [],
            appointments: response.items,
          }).afterClosed(),
        );
        if (result?.kind === 'saved' || result?.kind === 'stale') this.refresh();
      } else if (task.leadId) {
        const state: LeadDetailDrawerState = { dirty: false };
        const result = await firstValueFrom(
          this.dialogs
            .open<LeadDetailDrawer, LeadDetailDrawerData, LeadDetailDrawerResult>(
              LeadDetailDrawer,
              {
                data: { leadIds: [task.leadId], initialLeadId: task.leadId, state },
                panelClass: 'lead-detail-drawer-panel',
                backdropClass: 'lead-detail-drawer-backdrop',
                position: { top: '0', right: '0' },
                width: 'min(74rem, calc(100vw - 3rem))',
                height: '100dvh',
                maxWidth: '100vw',
                ariaLabelledBy: 'lead-drawer-title',
                autoFocus: 'dialog',
                enterAnimationDuration: 180,
                exitAnimationDuration: 140,
              },
            )
            .afterClosed(),
        );
        if (result?.dirty || state.dirty) this.refresh();
      }
    } catch {
      this.openError.set(this.i18n.t('dashboard.board.openFailed'));
    } finally {
      this.opening.set(false);
      if (scope === this.viewScope())
        requestAnimationFrame(() => {
          window.scrollTo({ top: scrollY, behavior: 'instant' });
          if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
        });
    }
  }
}
