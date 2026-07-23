import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { KolssApiClient } from '../../../core/api/generated/kolss-api.client';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { MessageKey } from '../../../core/i18n/messages';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SessionService } from '../../../core/session/session.service';
import {
  callStatusTone,
  commentDueAtForLead,
  clientStatusTone,
  groupLeadsForDashboard,
  showroomDueAtForLead,
} from '../../../services/crm-mock.helpers';
import type { LeadMarkerKind, MockLead } from '../../../services/crm-mock.types';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { UiButton } from '../../../ui/button/ui-button';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { LinkifiedText } from '../../../ui/text/linkified-text';
import { UiUser } from '../../../ui/user/ui-user';
import {
  LeadDetailDrawer,
  type LeadDetailDrawerData,
  type LeadDetailDrawerResult,
  type LeadDetailDrawerState,
} from '../leads/lead-detail-drawer';
import { LeadMarkerToggles } from '../leads/lead-marker-toggles';
import { LeadDueDate } from '../leads/lead-due-date';
import { TodayAppointmentsWidget } from './today-appointments-widget';

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
  template: `
    <section class="dashboard-page" aria-labelledby="dashboard-title">
      <header class="page-header">
        <div>
          <p class="page-kicker">{{ 'dashboard.kicker' | translate }}</p>
          <h1 id="dashboard-title">{{ 'dashboard.title' | translate }}</h1>
          <p>{{ 'dashboard.subtitle' | translate }}</p>
        </div>
        <app-ui-button routerLink="/crm/leads">
          <app-ui-icon name="view_kanban" [size]="17" />
          {{ 'dashboard.openLeads' | translate }}
        </app-ui-button>
      </header>

      <div class="dashboard-grid">
        <article>
          <span>{{ 'dashboard.metric.leads' | translate }}</span>
          <strong>{{ overview()?.totalLeads ?? 0 }}</strong>
          <app-ui-badge tone="brand">{{ 'dashboard.badge.live' | translate }}</app-ui-badge>
        </article>
        <article>
          <span>{{ 'dashboard.metric.active' | translate }}</span>
          <strong>{{ overview()?.activeLeads ?? 0 }}</strong>
          <app-ui-badge tone="info">{{ 'dashboard.badge.statuses' | translate }}</app-ui-badge>
        </article>
        <article>
          <span>{{ 'dashboard.metric.successful' | translate }}</span>
          <strong>{{ overview()?.successfulLeads ?? 0 }}</strong>
          <app-ui-badge tone="success">{{ 'dashboard.badge.contract' | translate }}</app-ui-badge>
        </article>
        <article>
          <span>{{ 'dashboard.metric.employees' | translate }}</span>
          <strong>{{ overview()?.employees ?? 0 }}</strong>
          <app-ui-badge tone="neutral">{{ 'dashboard.badge.profiles' | translate }}</app-ui-badge>
        </article>
      </div>

      <app-today-appointments-widget />

      <div class="reminders">
        <div class="reminders-head">
          <h2>{{ 'dashboard.remindersTitle' | translate }}</h2>
          <p>{{ 'dashboard.remindersHint' | translate }}</p>
        </div>

        @if (leadsResource.isLoading()) {
          <div class="loading" aria-live="polite">
            @for (row of skeletonRows; track row) {
              <span></span>
            }
          </div>
        } @else if (loadError()) {
          <p class="load-error" role="alert">{{ loadError() }}</p>
        } @else {
          @if (markerError()) {
            <p class="load-error" role="alert">{{ markerError() }}</p>
          }
          <div class="groups">
            @for (group of groups(); track group.key; let isFirst = $first) {
              <details [class]="'group group-' + group.key" [open]="isFirst">
                <summary>
                  <span class="group-title">
                    <app-ui-icon [name]="group.icon" [size]="18" />
                    {{ groupTitle(group.key) }}
                  </span>
                  <app-ui-badge [tone]="group.tone">{{ group.rows.length }}</app-ui-badge>
                  <app-ui-icon class="chevron" name="keyboard_arrow_down" [size]="20" />
                </summary>

                @if (group.rows.length) {
                  <ul class="lead-list">
                    @for (lead of group.rows; track lead.id) {
                      <li class="lead-row">
                        <button
                          type="button"
                          class="lead-open"
                          [attr.data-lead-id]="lead.id"
                          [attr.aria-label]="i18n.t('dashboard.openLead', { name: lead.name })"
                          (click)="openLead(lead)"
                        >
                          <span class="lead-main">
                            <strong>{{ lead.name }}</strong>
                            <small>{{ lead.phone }}</small>
                            @if (lead.latestTimelineComment; as latest) {
                              <small class="lead-comment" [title]="latest.comment">
                                {{ formatDayMonth(latest.occurredAt) }} ·
                                <app-linkified-text [text]="latest.comment" />
                              </small>
                            }
                            @if (commentDueAtForLead(lead); as commentDueAt) {
                              <app-lead-due-date
                                class="comment-next-action"
                                [date]="commentDueAt"
                                kind="comment"
                              />
                            }
                          </span>
                          <span class="lead-meta">
                            @if (hasActiveManager(lead.assignedToId)) {
                              <app-ui-user
                                [userId]="lead.assignedToId!"
                                [name]="employeeName(lead.assignedToId)"
                                size="sm"
                              />
                            } @else {
                              <span class="muted">{{ 'common.unassigned' | translate }}</span>
                            }
                            @if (lead.callStatus; as status) {
                              <span class="lead-status">
                                <app-ui-badge [tone]="callStatusTone(status)">
                                  {{ callStatusLabel(status) }}
                                </app-ui-badge>
                                @if (status === 'callback_requested' && lead.callbackDueAt) {
                                  <app-lead-due-date [date]="lead.callbackDueAt" />
                                }
                              </span>
                            }
                            @if (lead.clientStatus === 'thinking') {
                              <span class="lead-status">
                                <app-ui-badge [tone]="clientStatusTone(lead.clientStatus)">
                                  {{ i18n.clientStatusLabel(lead.clientStatus) }}
                                </app-ui-badge>
                                @if (lead.callbackDueAt) {
                                  <app-lead-due-date [date]="lead.callbackDueAt" />
                                }
                              </span>
                            } @else if (showroomDueAtForLead(lead); as showroomDueAt) {
                              <span class="lead-status">
                                <app-ui-badge [tone]="clientStatusTone(lead.clientStatus)">
                                  {{ i18n.clientStatusLabel(lead.clientStatus) }}
                                </app-ui-badge>
                                <app-lead-due-date [date]="showroomDueAt" />
                              </span>
                            }
                            <time class="created-date">{{
                              formatDayMonth(lead.sourceCreatedAt)
                            }}</time>
                          </span>
                        </button>
                        <app-lead-marker-toggles
                          [markers]="lead.markers"
                          [pending]="pendingMarker(lead.id)"
                          (toggled)="toggleMarker(lead, $event)"
                        />
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="group-empty">{{ 'dashboard.emptyGroup' | translate }}</p>
                }
              </details>
            }
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .dashboard-page {
      display: grid;
      gap: var(--ui-space-5);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: var(--ui-space-6);
    }

    .page-kicker {
      margin: 0 0 var(--ui-space-2);
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
      font-weight: 750;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-family: var(--ui-font-display);
      font-size: 2rem;
      letter-spacing: 0;
    }

    .page-header p:not(.page-kicker) {
      margin: var(--ui-space-2) 0 0;
      color: var(--ui-text-muted);
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--ui-space-4);
    }

    article {
      min-height: 9rem;
      padding: var(--ui-space-5);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      display: grid;
      align-content: space-between;
      box-shadow: var(--ui-shadow-1);
    }

    article span {
      color: var(--ui-text-muted);
      font-size: 0.875rem;
      font-weight: 650;
    }

    article strong {
      font-family: var(--ui-font-display);
      font-size: 2.5rem;
      line-height: 1;
    }

    .reminders {
      display: grid;
      gap: var(--ui-space-4);
    }

    .reminders-head h2 {
      margin: 0;
      font-family: var(--ui-font-display);
      font-size: 1.4rem;
    }

    .reminders-head p {
      margin: var(--ui-space-1) 0 0;
      color: var(--ui-text-muted);
      font-size: 0.875rem;
    }

    .groups {
      display: grid;
      gap: var(--ui-space-3);
    }

    .group {
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
    }

    summary {
      display: flex;
      align-items: center;
      gap: var(--ui-space-3);
      padding: var(--ui-space-4);
      cursor: pointer;
      list-style: none;
      user-select: none;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    .group-new summary {
      background: oklch(96% 0.04 235);
    }

    .group-callback summary {
      background: oklch(96% 0.055 70);
    }

    .group-showroom summary {
      background: oklch(96% 0.06 120);
    }

    .group-calculation summary {
      background: oklch(96% 0.04 195);
    }

    .group-in_work summary {
      background: oklch(95% 0.055 260);
    }

    .group-paused summary {
      background: oklch(96% 0.03 300);
    }

    .group-title {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
      font-weight: 750;
      font-size: 0.95rem;
    }

    summary app-ui-badge {
      margin-left: auto;
    }

    .chevron {
      color: var(--ui-text-subtle);
      transition: transform var(--ui-duration-fast) var(--ui-ease);
    }

    .group[open] .chevron {
      transform: rotate(180deg);
    }

    .lead-list {
      margin: 0;
      padding: 0;
      list-style: none;
      border-top: 1px solid var(--ui-border);
    }

    .lead-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--ui-space-2);
      padding: 0 var(--ui-space-4) 0 0;
      border-bottom: 1px solid var(--ui-border);
      transition: background var(--ui-duration-fast) var(--ui-ease);
    }

    .lead-row:last-child {
      border-bottom: 0;
    }

    .lead-row:hover,
    .lead-row:focus-within {
      background: var(--ui-surface-subtle);
    }

    .lead-open {
      min-width: 0;
      padding: var(--ui-space-3) 0 var(--ui-space-3) var(--ui-space-4);
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-space-3);
      cursor: pointer;
    }

    .lead-open:focus-visible {
      outline: none;
      box-shadow: inset 3px 0 var(--ui-action);
    }

    .lead-main {
      display: grid;
      min-width: 0;
    }

    .lead-main strong,
    .lead-main small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lead-main small {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
    }

    .lead-main .lead-comment {
      margin-top: 2px;
      color: var(--ui-text-muted);
      font-style: italic;
    }

    .lead-meta {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-3);
      flex-shrink: 0;
    }

    .lead-meta app-ui-user {
      max-width: 10rem;
    }

    .lead-meta .muted {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
    }

    .lead-status {
      display: inline-grid;
      justify-items: start;
    }

    .lead-meta .created-date {
      color: var(--ui-text-muted);
      font-size: 0.8125rem;
      text-transform: capitalize;
    }

    .group-empty {
      margin: 0;
      padding: var(--ui-space-4);
      border-top: 1px solid var(--ui-border);
      color: var(--ui-text-subtle);
      font-size: 0.875rem;
    }

    .loading {
      display: grid;
      gap: var(--ui-space-2);
    }

    .loading span {
      height: 3.25rem;
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-subtle);
      animation: pulse 1.1s ease-in-out infinite;
    }

    .load-error {
      margin: 0;
      color: var(--ui-danger);
    }

    @keyframes pulse {
      50% {
        opacity: 0.5;
      }
    }

    @media (max-width: 48rem) {
      .page-header {
        align-items: start;
        flex-direction: column;
      }

      .dashboard-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .lead-open {
        align-items: flex-start;
        flex-direction: column;
      }

      .lead-meta {
        flex-wrap: wrap;
      }
    }
  `,
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

  protected readonly loadError = computed(() => {
    const error = this.leadsResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });

  protected groupTitle(key: string): string {
    return this.i18n.t(`dashboard.group.${key}` as MessageKey);
  }

  protected callStatusLabel(status: MockLead['callStatus']): string {
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

  protected async toggleMarker(lead: MockLead, kind: LeadMarkerKind): Promise<void> {
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

  protected async openLead(lead: MockLead): Promise<void> {
    const leadIds = this.groups().flatMap((group) => group.rows.map((row) => row.id));
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
