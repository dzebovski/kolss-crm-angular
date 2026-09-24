import { Component, computed, inject, input, resource, signal } from '@angular/core';
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
import { leadIsTerminal, type LeadReminderKind } from '@domain/lead.rules';
import { v2CurrentStatus, v2LeadTasks } from '@domain/v2/lead-card-status';
import type { LeadEvent } from '@domain/lead.types';
import { toV2LeadCard } from '@domain/v2/lead-card.mapper';
import { v2LeadTimeline } from '@domain/v2/lead-timeline';
import { UsersService } from '@services/users.service';
import { V2LeadCardService } from '@services/v2/v2-lead-card.service';
import { V2_NOW } from '../../core/v2-clock';
import { V2DialogService } from '../../ui/dialog/v2-dialog.service';
import { V2Button } from '../../ui/v2-button';
import { V2EmptyState } from '../../ui/v2-empty-state';
import { V2_CHANNEL_LABEL } from '../../ui/v2-lead-labels';
import { V2CurrentStatusCard } from './v2-current-status-card';
import { V2EditContactDialog, type V2EditContactData } from './v2-edit-contact-dialog';
import { V2LeadCardHeader } from './v2-lead-card-header';
import { V2LeadDocumentsCard } from './v2-lead-documents-card';
import { V2LeadTasksCard } from './v2-lead-tasks-card';
import { V2LeadTimeline } from './v2-lead-timeline';
import {
  V2DeleteEntryDialog,
  V2EditEntryDialog,
  type V2DeleteEntryData,
  type V2EditEntryData,
} from './v2-timeline-entry-dialogs';

// Lead card v1.3 (`/v2/leads/:leadId`): breadcrumb, meta row, project banner, header card (C1).
// The action panel (C2), info cards (C4) and timeline (C5) follow below the header. Data comes
// from `GET /v1/leads/{id}` (shared v1 mapping + the v2 columns).
@Component({
  selector: 'app-v2-lead-card-page',
  imports: [
    RouterLink,
    TranslatePipe,
    V2Button,
    V2CurrentStatusCard,
    V2EmptyState,
    V2LeadCardHeader,
    V2LeadDocumentsCard,
    V2LeadTasksCard,
    V2LeadTimeline,
  ],
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

  private readonly employeeNames = computed(
    () => new Map(this.employees().map((employee) => [employee.id, employee.displayName])),
  );
  /** Bound field so presentational cards can call it detached from `this`. */
  protected readonly personName = (id: string): string | null =>
    this.employeeNames().get(id) ?? null;

  protected readonly managerName = computed(() => {
    const id = this.card()?.managerId;
    return id ? this.personName(id) : null;
  });

  protected readonly currentStatus = computed(() => {
    const loaded = this.loaded();
    const card = this.card();
    if (!loaded || !card) return null;
    return v2CurrentStatus(loaded.lead, card.status, loaded.columns.noAnswerAttempts);
  });

  protected readonly attachments = computed(() => this.loaded()?.lead.attachments ?? []);

  protected readonly tasks = computed(() => {
    const lead = this.loaded()?.lead;
    return lead ? v2LeadTasks(lead, this.now()) : [];
  });

  /** Lost and project leads need no next step (design: no "No next step planned" notice). */
  protected readonly needsNextStep = computed(() => {
    const status = this.card()?.status;
    return status !== 'lost' && status !== 'project' && !this.card()?.archived;
  });

  /** v1 rule: reminders of archived or closed leads can't be cleared. */
  protected readonly canCompleteTasks = computed(() => {
    const lead = this.loaded()?.lead;
    return Boolean(lead && !lead.archivedAt && !leadIsTerminal(lead));
  });
  protected readonly taskPending = signal(false);
  protected readonly entryPending = signal(false);
  protected readonly translatingIds = signal<ReadonlySet<string>>(new Set());

  protected readonly timeline = computed(() => {
    const lead = this.loaded()?.lead;
    const card = this.card();
    return lead && card ? v2LeadTimeline(lead, card.channel) : [];
  });

  /** Bound field: v1 rule (own entries, or any for a super admin; none on archived leads). */
  protected readonly canMutateEntry = (event: LeadEvent): boolean =>
    !this.card()?.archived && leadPolicy.canMutateEvent(this.policyContext(), event);
  protected readonly actionError = signal('');

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

  protected async completeTask(kind: LeadReminderKind): Promise<void> {
    const lead = this.loaded()?.lead;
    if (!lead || !this.canCompleteTasks() || this.taskPending()) return;
    this.taskPending.set(true);
    this.actionError.set('');
    try {
      await this.service.completeReminder(lead.id, kind);
      this.leadResource.reload();
    } catch (error) {
      this.actionError.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.taskPending.set(false);
    }
  }

  protected async editEntry(event: LeadEvent): Promise<void> {
    const lead = this.loaded()?.lead;
    if (!lead || !this.canMutateEntry(event) || this.entryPending()) return;
    const ref = this.dialogs.open<string, V2EditEntryData>(V2EditEntryDialog, {
      comment: event.comment ?? '',
    });
    const comment = await firstValueFrom(ref.closed);
    if (!comment || comment === event.comment?.trim()) return;
    await this.runEntryAction(() => this.service.updateEntry(lead.id, event.id, comment));
  }

  protected async deleteEntry(event: LeadEvent): Promise<void> {
    const lead = this.loaded()?.lead;
    if (!lead || !this.canMutateEntry(event) || this.entryPending()) return;
    const ref = this.dialogs.open<boolean, V2DeleteEntryData>(V2DeleteEntryDialog, {
      officeWork: event.type === 'office_work',
    });
    if (!(await firstValueFrom(ref.closed))) return;
    await this.runEntryAction(() => this.service.deleteEntry(lead.id, event.id));
  }

  protected async translateEntry(event: LeadEvent): Promise<void> {
    const lead = this.loaded()?.lead;
    if (!lead || this.translatingIds().has(event.id)) return;
    this.translatingIds.update((ids) => new Set(ids).add(event.id));
    this.actionError.set('');
    try {
      await this.service.translateEntry(lead.id, event.id);
      this.leadResource.reload();
    } catch {
      this.actionError.set(this.i18n.t('leadDetail.translationFailed'));
    } finally {
      this.translatingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(event.id);
        return next;
      });
    }
  }

  private async runEntryAction(action: () => Promise<void>): Promise<void> {
    this.entryPending.set(true);
    this.actionError.set('');
    try {
      await action();
      this.leadResource.reload();
    } catch (error) {
      this.actionError.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.entryPending.set(false);
    }
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
