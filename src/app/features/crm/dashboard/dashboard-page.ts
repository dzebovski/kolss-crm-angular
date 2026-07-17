import { Component, computed, inject, resource } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { SessionService } from '../../../core/session/session.service';
import { KolssApiClient } from '../../../core/api/generated/kolss-api.client';
import {
  CALL_STATUS_LABELS,
  callStatusTone,
  groupLeadsForDashboard,
} from '../../../services/crm-mock.helpers';
import type { MockLead } from '../../../services/crm-mock.types';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiButton } from '../../../ui/button/ui-button';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiUser } from '../../../ui/user/ui-user';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, UiBadge, UiButton, UiIcon, UiUser],
  template: `
    <section class="dashboard-page" aria-labelledby="dashboard-title">
      <header class="page-header">
        <div>
          <p class="page-kicker">CRM overview</p>
          <h1 id="dashboard-title">Огляд</h1>
          <p>Короткий стан CRM з реальних даних Supabase.</p>
        </div>
        <app-ui-button routerLink="/crm/leads">
          <app-ui-icon name="view_kanban" [size]="17" />
          Відкрити ліди
        </app-ui-button>
      </header>

      <div class="dashboard-grid">
        <article>
          <span>Ліди</span>
          <strong>{{ overview()?.totalLeads ?? 0 }}</strong>
          <app-ui-badge tone="brand">live</app-ui-badge>
        </article>
        <article>
          <span>Активні</span>
          <strong>{{ overview()?.activeLeads ?? 0 }}</strong>
          <app-ui-badge tone="info">statuses</app-ui-badge>
        </article>
        <article>
          <span>Успішні</span>
          <strong>{{ overview()?.successfulLeads ?? 0 }}</strong>
          <app-ui-badge tone="success">contract</app-ui-badge>
        </article>
        <article>
          <span>Співробітники</span>
          <strong>{{ overview()?.employees ?? 0 }}</strong>
          <app-ui-badge tone="neutral">profiles</app-ui-badge>
        </article>
      </div>

      <div class="reminders">
        <div class="reminders-head">
          <h2>Нагадування для менеджерів</h2>
          <p>Ліди в роботі, розділені за статусом.</p>
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
          <div class="groups">
            @for (group of groups(); track group.key; let isFirst = $first) {
              <details [class]="'group group-' + group.key" [open]="isFirst">
                <summary>
                  <span class="group-title">
                    <app-ui-icon [name]="group.icon" [size]="18" />
                    {{ group.title }}
                  </span>
                  <app-ui-badge [tone]="group.tone">{{ group.rows.length }}</app-ui-badge>
                  <app-ui-icon class="chevron" name="keyboard_arrow_down" [size]="20" />
                </summary>

                @if (group.rows.length) {
                  <ul class="lead-list">
                    @for (lead of group.rows; track lead.id) {
                      <li
                        class="lead-row"
                        tabindex="0"
                        role="link"
                        [attr.aria-label]="'Відкрити лід ' + lead.name"
                        (click)="openLead(lead)"
                        (keydown.enter)="openLead(lead)"
                      >
                        <span class="lead-main">
                          <strong>{{ lead.name }}</strong>
                          <small>{{ lead.phone }}</small>
                          @if (lead.latestTimelineComment?.comment; as comment) {
                            <small class="lead-comment" [title]="comment">{{ comment }}</small>
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
                            <span class="muted">Не призначено</span>
                          }
                          @if (lead.callStatus; as status) {
                            <app-ui-badge [tone]="callStatusTone(status)">
                              {{ callStatusLabel(status) }}
                            </app-ui-badge>
                          }
                          <time>{{ formatDayMonth(lead.sourceCreatedAt) }}</time>
                        </span>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="group-empty">Немає лідів</p>
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
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-space-3);
      padding: var(--ui-space-3) var(--ui-space-4);
      border-bottom: 1px solid var(--ui-border);
      cursor: pointer;
      transition: background var(--ui-duration-fast) var(--ui-ease);
    }

    .lead-row:last-child {
      border-bottom: 0;
    }

    .lead-row:hover,
    .lead-row:focus-visible {
      background: var(--ui-surface-subtle);
      outline: none;
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

    .lead-meta time {
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
    }
  `,
})
export class DashboardPage {
  private readonly session = inject(SessionService);
  private readonly api = inject(KolssApiClient);
  private readonly leadsService = inject(LeadsService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);

  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly callStatusTone = callStatusTone;

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

  protected callStatusLabel(status: MockLead['callStatus']): string {
    return status ? CALL_STATUS_LABELS[status] : '';
  }

  protected employeeName(employeeId: string | null): string {
    if (!employeeId) return 'Не призначено';
    return (
      (this.employeesResource.value() ?? []).find((employee) => employee.id === employeeId)
        ?.displayName ?? 'Не призначено'
    );
  }

  protected hasActiveManager(employeeId: string | null): boolean {
    return (
      !!employeeId &&
      (this.employeesResource.value() ?? []).some((employee) => employee.id === employeeId)
    );
  }

  protected formatDayMonth(value: string): string {
    return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: 'short' }).format(
      new Date(value),
    );
  }

  protected async openLead(lead: MockLead): Promise<void> {
    await this.router.navigate(['/crm/leads', lead.id]);
  }
}
