import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { SessionService } from '@core/session/session.service';
import {
  callStatusTone,
  commentAssigneeForLead,
  commentDueAtForLead,
  clientStatusTone,
  groupLeadsForDashboard,
  showroomDueAtForLead,
} from '@domain/lead.rules';
import type { LeadMarkerKind, Lead } from '@domain/lead.types';
import { LeadsService } from '@services/leads.service';
import { UsersService } from '@services/users.service';
import { UiButton } from '@ui/button/ui-button';
import { UiDialogService } from '@ui/dialog/ui-dialog';
import { UiBadge } from '@ui/feedback/ui-badge';
import { UiIcon } from '@ui/icon/ui-icon';
import { LinkifiedText } from '@ui/text/linkified-text';
import { UiUser } from '@ui/user/ui-user';
import {
  LeadDetailDrawer,
  type LeadDetailDrawerData,
  type LeadDetailDrawerResult,
  type LeadDetailDrawerState,
} from '@features/crm/leads/lead-detail-drawer';
import { LeadMarkerToggles } from '@features/crm/leads/lead-marker-toggles';
import { LeadDueDate } from '@features/crm/leads/lead-due-date';
import { TodayAppointmentsWidget } from './today-appointments-widget';

interface ManagerTaskGroup {
  readonly managerId: string;
  readonly managerName: string;
  readonly tasks: readonly Lead[];
}

@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    LeadDueDate,
    LeadMarkerToggles,
    LinkifiedText,
    TranslatePipe,
    UiBadge,
    UiButton,
    UiIcon,
    UiUser,
    TodayAppointmentsWidget,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly session = inject(SessionService);
  private readonly api = inject(KolssApiClient);
  private readonly leadsService = inject(LeadsService);
  private readonly usersService = inject(UsersService);
  private readonly dialog = inject(UiDialogService);
  protected readonly i18n = inject(I18nService);

  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly callStatusTone = callStatusTone;
  protected readonly clientStatusTone = clientStatusTone;
  protected readonly markerError = signal('');
  private readonly markerPendingKey = signal('');

  protected readonly overviewResource = resource({
    params: () => ({ officeId: this.session.selectedOfficeId() }),
    loader: ({ params }) => this.api.dashboard(params),
  });
  protected readonly overview = computed(() => this.overviewResource.value());

  protected readonly leadsResource = resource({
    params: () => ({ officeId: this.session.selectedOfficeId(), archived: 'active' as const }),
    loader: ({ params }) => this.leadsService.list(params),
  });

  protected readonly employeesResource = resource({
    loader: () => this.usersService.listManagers(),
  });

  protected readonly groups = computed(() =>
    groupLeadsForDashboard(this.leadsResource.value() ?? []),
  );

  /** Active leads whose latest comment is a manager task, grouped by assignee. */
  protected readonly managerTasks = computed<readonly ManagerTaskGroup[]>(() => {
    const leads = (this.leadsResource.value() ?? []).filter(
      (lead) => !lead.archivedAt && commentAssigneeForLead(lead),
    );
    const byManager = new Map<string, Lead[]>();
    for (const lead of leads) {
      const managerId = commentAssigneeForLead(lead)!;
      const bucket = byManager.get(managerId);
      if (bucket) bucket.push(lead);
      else byManager.set(managerId, [lead]);
    }
    return [...byManager.entries()]
      .map(([managerId, tasks]) => ({
        managerId,
        managerName: this.employeeName(managerId),
        tasks: [...tasks].sort((left, right) =>
          (commentDueAtForLead(left) ?? '').localeCompare(commentDueAtForLead(right) ?? ''),
        ),
      }))
      .sort((left, right) => left.managerName.localeCompare(right.managerName, this.i18n.locale()));
  });

  protected readonly taskCount = computed(() =>
    this.managerTasks().reduce((total, group) => total + group.tasks.length, 0),
  );

  protected readonly loadError = computed(() => {
    const error = this.leadsResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });

  protected groupTitle(key: string): string {
    return this.i18n.t(`dashboard.group.${key}` as MessageKey);
  }

  protected callStatusLabel(status: Lead['callStatus']): string {
    return status ? this.i18n.callStatusLabel(status) : '';
  }

  protected employeeName(employeeId: string | null): string {
    if (!employeeId) return this.i18n.t('common.unassigned');
    return (
      (this.employeesResource.value() ?? []).find((employee) => employee.id === employeeId)
        ?.displayName ?? this.i18n.t('common.unassigned')
    );
  }

  protected hasActiveManager(employeeId: string | null): boolean {
    return (
      !!employeeId &&
      (this.employeesResource.value() ?? []).some((employee) => employee.id === employeeId)
    );
  }

  protected formatDayMonth(value: string): string {
    const locale = { uk: 'uk-UA', pl: 'pl-PL', en: 'en-GB' }[this.i18n.locale()];
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(
      new Date(value),
    );
  }

  protected readonly commentDueAtForLead = commentDueAtForLead;
  protected readonly showroomDueAtForLead = showroomDueAtForLead;

  protected pendingMarker(leadId: string): LeadMarkerKind | null {
    const prefix = `${leadId}:`;
    const key = this.markerPendingKey();
    return key.startsWith(prefix) ? (key.slice(prefix.length) as LeadMarkerKind) : null;
  }

  protected async toggleMarker(lead: Lead, kind: LeadMarkerKind): Promise<void> {
    if (this.markerPendingKey()) return;
    this.markerError.set('');
    this.markerPendingKey.set(`${lead.id}:${kind}`);
    const active = lead.markers.some((marker) => marker.kind === kind);
    try {
      const markers = active
        ? lead.markers.filter((marker) => marker.kind !== kind)
        : [...lead.markers, await this.leadsService.setMarker(lead.id, kind)];
      if (active) await this.leadsService.deleteMarker(lead.id, kind);
      this.leadsResource.value.update((leads) =>
        leads?.map((item) => (item.id === lead.id ? { ...item, markers } : item)),
      );
    } catch (error) {
      this.markerError.set(
        error instanceof Error ? error.message : this.i18n.t('dashboard.markerSaveFailed'),
      );
    } finally {
      this.markerPendingKey.set('');
    }
  }

  protected async openLead(lead: Lead): Promise<void> {
    const leadIds = [
      ...new Set([
        ...this.groups().flatMap((group) => group.rows.map((row) => row.id)),
        ...this.managerTasks().flatMap((group) => group.tasks.map((task) => task.id)),
      ]),
    ];
    if (!leadIds.length) return;
    const scrollY = window.scrollY;
    const state: LeadDetailDrawerState = { dirty: false };
    const result = await firstValueFrom(
      this.dialog
        .open<LeadDetailDrawer, LeadDetailDrawerData, LeadDetailDrawerResult>(LeadDetailDrawer, {
          data: { leadIds, initialLeadId: lead.id, state },
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
        })
        .afterClosed(),
    );
    if (result?.dirty || state.dirty) await this.refreshDashboard(scrollY, lead.id);
  }

  private async refreshDashboard(scrollY: number, focusLeadId: string): Promise<void> {
    const officeId = this.session.selectedOfficeId();
    try {
      const [overview, leads] = await Promise.all([
        this.api.dashboard({ officeId }),
        this.leadsService.list({ officeId, archived: 'active' }),
      ]);
      this.overviewResource.value.set(overview);
      this.leadsResource.value.set(leads);
    } catch (error) {
      this.markerError.set(
        error instanceof Error ? error.message : this.i18n.t('dashboard.refreshFailed'),
      );
    } finally {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: 'instant' });
        document
          .querySelector<HTMLButtonElement>(`.lead-open[data-lead-id="${focusLeadId}"]`)
          ?.focus({ preventScroll: true });
      });
    }
  }
}
