import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  formatDateTime,
  groupLeadsByYearMonth,
  LEAD_SOURCE_LABELS,
  matchesLeadSearch,
  officeName,
  WORKFLOW_LABELS,
  workflowTone,
} from '../../../services/crm-mock.helpers';
import { CrmMockService } from '../../../services/crm-mock.service';
import type { MockLead } from '../../../services/crm-mock.types';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiButton } from '../../../ui/button/ui-button';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiTextField } from '../../../ui/form/ui-text-field';

@Component({
  selector: 'app-leads-page',
  imports: [UiBadge, UiButton, UiIcon, UiTextField],
  template: `
    <section class="crm-page" aria-labelledby="leads-title">
      <header class="page-header">
        <div>
          <p class="page-kicker">CRM pipeline</p>
          <h1 id="leads-title">Ліди</h1>
          <p>10 мок-клієнтів, згруповані за місяцем створення. Дані не пишуться в Supabase.</p>
        </div>
        <div class="page-actions">
          <app-ui-button variant="secondary" (pressed)="simulateLoading()">
            <app-ui-icon name="history" [size]="17" />
            Loading state
          </app-ui-button>
          <app-ui-button (pressed)="showCreateState()">
            <app-ui-icon name="add" [size]="17" />
            Створити лід
          </app-ui-button>
        </div>
      </header>

      @if (notice()) {
        <div class="notice" role="status">
          <app-ui-icon name="info" [size]="18" />
          {{ notice() }}
        </div>
      }

      <div class="leads-toolbar">
        <app-ui-text-field
          label="Пошук"
          type="search"
          placeholder="Телефон, ПІБ або дата"
          [(value)]="query"
        />
        <div class="toolbar-metrics" aria-label="Поточні показники">
          <div>
            <strong>{{ filteredLeads().length }}</strong>
            <span>знайдено</span>
          </div>
          <div>
            <strong>{{ activeCount() }}</strong>
            <span>активні</span>
          </div>
          <div>
            <strong>{{ terminalCount() }}</strong>
            <span>завершені</span>
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="table-state" aria-live="polite">
          @for (row of skeletonRows; track row) {
            <span></span>
          }
        </div>
      } @else if (!filteredLeads().length) {
        <article class="empty-state">
          <app-ui-icon name="inbox" [size]="28" />
          <h2>Немає результатів</h2>
          <p>Спробуйте інший телефон, дату або імʼя клієнта.</p>
        </article>
      } @else {
        <div class="lead-groups">
          @for (group of groupedLeads(); track group.key) {
            <section class="lead-group" [attr.aria-labelledby]="'group-' + group.key">
              <header>
                <h2 [id]="'group-' + group.key">{{ group.label }}</h2>
                <span>{{ group.rows.length }} лідів</span>
              </header>

              <div class="leads-table-wrap">
                <table class="leads-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Клієнт</th>
                      <th>Перший дзвінок</th>
                      <th>Джерело</th>
                      <th>Перший менеджер</th>
                      <th>Візит у салон</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (lead of group.rows; track lead.id) {
                      <tr
                        tabindex="0"
                        role="link"
                        [attr.aria-label]="'Відкрити лід ' + lead.name"
                        (click)="openLead(lead)"
                        (keydown.enter)="openLead(lead)"
                      >
                        <td>
                          <span>{{ formatDateTime(lead.sourceCreatedAt) }}</span>
                          <small>{{ officeName(lead.officeCode) }}</small>
                        </td>
                        <td>
                          <strong>{{ lead.name }}</strong>
                          <small>{{ lead.phone }}</small>
                        </td>
                        <td>
                          @if (lead.firstCall) {
                            <span>{{ lead.firstCall.result }}</span>
                            <small>{{ formatDateTime(lead.firstCall.date) }}</small>
                          } @else {
                            <span class="muted">Ще не зафіксовано</span>
                          }
                        </td>
                        <td>{{ sourceLabel(lead) }}</td>
                        <td>{{ employeeName(lead.firstManagerId) }}</td>
                        <td>
                          <div class="status-cell">
                            <app-ui-badge [tone]="workflowTone(lead.workflowStatus)">
                              {{ workflowLabel(lead) }}
                            </app-ui-badge>
                            @if (lead.visit) {
                              <small>{{ formatDateTime(lead.visit.scheduledAt) }}</small>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .crm-page {
      display: grid;
      gap: var(--ui-space-5);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      gap: var(--ui-space-6);
      align-items: end;
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

    .page-actions {
      display: flex;
      gap: var(--ui-space-2);
      white-space: nowrap;
    }

    .notice {
      min-height: 2.75rem;
      padding: 0 var(--ui-space-4);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-raised);
      color: var(--ui-text-muted);
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
      box-shadow: var(--ui-shadow-1);
    }

    .notice app-ui-icon {
      color: var(--ui-info);
    }

    .leads-toolbar {
      display: grid;
      grid-template-columns: minmax(20rem, 28rem) auto;
      justify-content: space-between;
      gap: var(--ui-space-4);
      align-items: end;
    }

    .toolbar-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(6.5rem, 1fr));
      gap: var(--ui-space-2);
    }

    .toolbar-metrics div {
      min-height: 4rem;
      padding: var(--ui-space-3);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-raised);
      display: grid;
      gap: 0.125rem;
    }

    .toolbar-metrics strong {
      font-family: var(--ui-font-display);
      font-size: 1.5rem;
      line-height: 1;
    }

    .toolbar-metrics span {
      color: var(--ui-text-muted);
      font-size: 0.75rem;
    }

    .lead-groups {
      display: grid;
      gap: var(--ui-space-4);
    }

    .lead-group {
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
    }

    .lead-group > header {
      min-height: 3.25rem;
      padding: 0 var(--ui-space-4);
      border-bottom: 1px solid var(--ui-border);
      background: var(--ui-surface-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .lead-group h2 {
      margin: 0;
      font-size: 1rem;
    }

    .lead-group header span {
      color: var(--ui-text-muted);
      font-size: 0.8125rem;
      font-weight: 650;
    }

    .leads-table-wrap {
      overflow-x: auto;
    }

    .leads-table {
      width: 100%;
      min-width: 72rem;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    th,
    td {
      padding: var(--ui-space-3) var(--ui-space-4);
      border-bottom: 1px solid var(--ui-border);
      text-align: left;
      vertical-align: top;
    }

    th {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
      font-weight: 750;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    tbody tr {
      cursor: pointer;
      transition: background var(--ui-duration-fast) var(--ui-ease);
    }

    tbody tr:hover,
    tbody tr:focus-visible {
      background: var(--ui-surface-subtle);
      outline: none;
    }

    td strong,
    td span,
    td small {
      display: block;
    }

    td small,
    .muted {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
    }

    .status-cell {
      display: grid;
      gap: var(--ui-space-1);
      justify-items: start;
    }

    .table-state,
    .empty-state {
      min-height: 18rem;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      display: grid;
      place-items: center;
      color: var(--ui-text-muted);
    }

    .table-state {
      align-content: center;
      gap: var(--ui-space-3);
      padding: var(--ui-space-6);
    }

    .table-state span {
      width: min(100%, 52rem);
      height: 2.5rem;
      border-radius: var(--ui-radius-md);
      background: linear-gradient(
        90deg,
        var(--ui-surface-subtle),
        var(--ui-surface-muted),
        var(--ui-surface-subtle)
      );
      animation: pulse 1.1s ease-in-out infinite;
    }

    .empty-state {
      align-content: center;
      gap: var(--ui-space-2);
      text-align: center;
    }

    .empty-state h2,
    .empty-state p {
      margin: 0;
    }

    @keyframes pulse {
      50% {
        opacity: 0.55;
      }
    }
  `,
})
export class LeadsPage {
  private readonly crm = inject(CrmMockService);
  private readonly router = inject(Router);

  protected readonly query = signal('');
  protected readonly loading = signal(false);
  protected readonly notice = signal('');
  protected readonly skeletonRows = [1, 2, 3, 4];

  protected readonly filteredLeads = computed(() =>
    this.crm.visibleLeads().filter((lead) => matchesLeadSearch(lead, this.query())),
  );
  protected readonly groupedLeads = computed(() => groupLeadsByYearMonth(this.filteredLeads()));
  protected readonly activeCount = computed(
    () =>
      this.filteredLeads().filter(
        (lead) => lead.workflowStatus !== 'closed' && lead.workflowStatus !== 'successful',
      ).length,
  );
  protected readonly terminalCount = computed(
    () =>
      this.filteredLeads().filter(
        (lead) => lead.workflowStatus === 'closed' || lead.workflowStatus === 'successful',
      ).length,
  );

  protected readonly formatDateTime = formatDateTime;
  protected readonly officeName = officeName;
  protected readonly workflowTone = workflowTone;

  protected employeeName(employeeId: string | null): string {
    return this.crm.employeeName(employeeId);
  }

  protected sourceLabel(lead: MockLead): string {
    return LEAD_SOURCE_LABELS[lead.source];
  }

  protected workflowLabel(lead: MockLead): string {
    return WORKFLOW_LABELS[lead.workflowStatus];
  }

  protected async openLead(lead: MockLead): Promise<void> {
    await this.router.navigate(['/crm/leads', lead.id]);
  }

  protected simulateLoading(): void {
    this.loading.set(true);
    this.notice.set('Показано loading state локальної таблиці.');
    setTimeout(() => this.loading.set(false), 700);
  }

  protected showCreateState(): void {
    this.notice.set('Створення ліда у прототипі змодельовано: реального запису в Supabase немає.');
  }
}
