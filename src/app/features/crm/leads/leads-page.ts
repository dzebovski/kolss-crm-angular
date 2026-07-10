import { Component, computed, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SessionService } from '../../../core/session/session.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  groupLeadsByYearMonth,
  LEAD_SOURCE_ICONS,
  matchesLeadSearch,
  officeName,
  workflowTone,
} from '../../../services/crm-mock.helpers';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import type { MockLead } from '../../../services/crm-mock.types';
import { UiAlert } from '../../../ui/feedback/ui-alert';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiButton } from '../../../ui/button/ui-button';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiUser } from '../../../ui/user/ui-user';
import { UiTextField } from '../../../ui/form/ui-text-field';
import { CreateLeadDialog } from './create-lead-dialog';

@Component({
  selector: 'app-leads-page',
  imports: [CreateLeadDialog, UiAlert, UiBadge, UiButton, UiIcon, UiTextField, UiUser, TranslatePipe],
  template: `
    <section class="crm-page" aria-labelledby="leads-title">
      <header class="page-header">
        <div>
          <p class="page-kicker">{{ 'leads.kicker' | translate }}</p>
          <h1 id="leads-title">{{ 'leads.title' | translate }}</h1>
          <p>{{ 'leads.subtitle' | translate }}</p>
        </div>
        <div class="page-actions">
          <app-ui-button (pressed)="openCreateDialog()">
            <app-ui-icon name="add" [size]="17" />
            {{ 'lead.create' | translate }}
          </app-ui-button>
          <app-ui-button variant="secondary" (pressed)="leadsResource.reload()">
            <app-ui-icon name="history" [size]="17" />
            {{ 'leads.refresh' | translate }}
          </app-ui-button>
        </div>
      </header>

      @if (loadError()) {
        <app-ui-alert tone="danger" [title]="'leads.loadError' | translate">
          {{ loadError() }}
        </app-ui-alert>
      }

      @if (notice()) {
        <div class="notice" role="status">
          <app-ui-icon name="info" [size]="18" />
          {{ notice() }}
        </div>
      }

      <div class="leads-toolbar">
        <app-ui-text-field
          [label]="'common.search' | translate"
          type="search"
          [placeholder]="'leads.searchPlaceholder' | translate"
          [(value)]="query"
        />
        <div class="toolbar-metrics" [attr.aria-label]="'leads.metricsAria' | translate">
          <div>
            <strong>{{ filteredLeads().length }}</strong>
            <span>{{ 'leads.found' | translate }}</span>
          </div>
          <div>
            <strong>{{ activeCount() }}</strong>
            <span>{{ 'leads.active' | translate }}</span>
          </div>
          <div>
            <strong>{{ terminalCount() }}</strong>
            <span>{{ 'leads.terminal' | translate }}</span>
          </div>
        </div>
      </div>

      @if (leadsResource.isLoading()) {
        <div class="table-state" aria-live="polite">
          @for (row of skeletonRows; track row) {
            <span></span>
          }
        </div>
      } @else if (!filteredLeads().length) {
        <article class="empty-state">
          <app-ui-icon name="inbox" [size]="28" />
          <h2>{{ 'leads.emptyTitle' | translate }}</h2>
          <p>{{ 'leads.emptyHint' | translate }}</p>
        </article>
      } @else {
        <div class="leads-table-panel">
          <table class="leads-table" [attr.aria-label]="'leads.tableAria' | translate">
            <colgroup>
              <col class="col-date" />
              <col class="col-client" />
              <col class="col-call" />
              <col class="col-source" />
              <col class="col-manager" />
              <col class="col-visit" />
            </colgroup>
            <thead>
              <tr>
                <th class="date-heading" scope="col">{{ 'common.date' | translate }}</th>
                <th class="client-heading" scope="col">{{ 'leads.colClient' | translate }}</th>
                <th class="call-heading" scope="col">{{ 'workflow.first_call_done' | translate }}</th>
                <th class="source-heading" scope="col">{{ 'leads.colSource' | translate }}</th>
                <th class="manager-heading" scope="col">{{ 'leads.colFirstManager' | translate }}</th>
                <th class="visit-heading" scope="col">{{ 'leads.colVisit' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (group of groupedLeads(); track group.key) {
                <tr class="month-row">
                  <th scope="rowgroup" colspan="6">
                    <span [id]="'group-' + group.key">{{ group.label }}</span>
                    <small>{{ 'leads.count' | translate: { count: group.rows.length } }}</small>
                  </th>
                </tr>

                @for (lead of group.rows; track lead.id) {
                  <tr
                    class="lead-row"
                    tabindex="0"
                    role="link"
                    [attr.data-lead-id]="lead.id"
                    [attr.aria-label]="'leads.openAria' | translate: { name: lead.name }"
                    (click)="openLead(lead)"
                    (keydown.enter)="openLead(lead)"
                  >
                    <td class="date-cell" [attr.data-label]="'common.date' | translate">
                      <span>{{ formatDateTime(lead.sourceCreatedAt) }}</span>
                      <small>{{ officeName(lead.officeCode) }}</small>
                    </td>
                    <td class="client-cell" [attr.data-label]="'leads.colClient' | translate">
                      <strong>{{ lead.name }}</strong>
                      <small>{{ lead.phone }}</small>
                    </td>
                    <td class="call-cell" [attr.data-label]="'workflow.first_call_done' | translate">
                      @if (lead.firstCall) {
                        <span>{{ firstCallResultLabel(lead) }}</span>
                        <small>{{ formatDateTime(lead.firstCall.date) }}</small>
                      } @else {
                        <span class="muted">{{ 'leads.notRecordedYet' | translate }}</span>
                      }
                    </td>
                    <td class="source-cell" [attr.data-label]="'leads.colSource' | translate">
                      <span class="source-pill">
                        <app-ui-icon [name]="sourceIcon(lead)" [size]="14" />
                        <span class="source-pill__text">{{ sourceLabel(lead) }}</span>
                      </span>
                    </td>
                    <td class="manager-cell" [attr.data-label]="'leads.colFirstManager' | translate">
                      @if (lead.firstManagerId) {
                        <app-ui-user
                          [userId]="lead.firstManagerId"
                          [name]="employeeName(lead.firstManagerId)"
                          size="sm"
                        />
                      } @else {
                        <span class="muted">{{ 'common.unassigned' | translate }}</span>
                      }
                    </td>
                    <td class="visit-cell" [attr.data-label]="'leads.colVisit' | translate">
                      <div class="status-cell">
                        <app-ui-badge [tone]="workflowTone(lead.workflowStatus)">
                          {{ workflowLabel(lead) }}
                        </app-ui-badge>
                        @if (lead.visit) {
                          <small>{{ formatDate(lead.visit.scheduledAt) }}</small>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (createDialogOpen()) {
      <app-create-lead-dialog
        (dismissed)="closeCreateDialog()"
        (created)="onLeadCreated($event)"
      />
    }
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
      font-family: var(--ui-font-display), sans-serif;
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

    .lead-row .source-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      max-width: 100%;
      min-width: 0;
      white-space: nowrap;
    }

    .lead-row .source-pill app-ui-icon {
      flex: 0 0 auto;
      color: var(--ui-text-subtle);
      transform: translateY(1px);
    }

    .lead-row .source-pill__text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
      font-family: var(--ui-font-display), sans-serif;
      font-size: 1.5rem;
      line-height: 1;
    }

    .toolbar-metrics span {
      color: var(--ui-text-muted);
      font-size: 0.75rem;
    }

    .leads-table-panel {
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
    }

    .leads-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 0.8125rem;
    }

    .col-date {
      width: 12%;
    }

    .col-client {
      width: 28%;
    }

    .col-call {
      width: 16%;
    }

    .col-source {
      width: 12%;
    }

    .col-manager {
      width: 16%;
    }

    .col-visit {
      width: 16%;
    }

    th,
    td {
      min-width: 0;
      padding: 0.625rem var(--ui-space-3);
      border-bottom: 1px solid var(--ui-border);
      overflow: hidden;
      text-align: left;
      vertical-align: middle;
    }

    th {
      height: 2.75rem;
      background: var(--ui-surface-raised);
      color: var(--ui-text-subtle);
      font-size: 0.6875rem;
      font-weight: 750;
      letter-spacing: 0.04em;
      line-height: 1.1;
      text-transform: uppercase;
    }

    .month-row th {
      height: 3rem;
      padding-block: 0;
      background: var(--ui-surface-subtle);
      border-top: 1px solid var(--ui-border);
      color: var(--ui-text);
      font-size: 0.875rem;
      letter-spacing: 0;
      text-transform: none;
      vertical-align: middle;
    }

    .month-row small {
      margin-left: var(--ui-space-2);
      color: var(--ui-text-muted);
      font-size: 0.75rem;
      font-weight: 650;
    }

    .lead-row {
      cursor: pointer;
      transition: background var(--ui-duration-fast) var(--ui-ease);
    }

    .lead-row:hover,
    .lead-row:focus-visible {
      background: var(--ui-surface-subtle);
      outline: none;
    }

    .lead-row td {
      height: 3.875rem;
      line-height: 1.2;
    }

    .lead-row strong,
    .lead-row span,
    .lead-row small {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lead-row small,
    .muted {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
    }

    .lead-compact-meta {
      display: none;
      margin-top: var(--ui-space-1);
      color: var(--ui-text-muted);
      font-size: 0.75rem;
    }

    .status-cell {
      display: grid;
      gap: 0.25rem;
      justify-items: start;
      min-width: 0;
      overflow: hidden;
    }

    .manager-cell app-ui-user {
      max-width: 100%;
    }

    .visit-cell app-ui-badge {
      max-width: 100%;
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

    @media (max-width: 64rem) {
      .col-source,
      .col-manager,
      .source-heading,
      .manager-heading,
      .source-cell,
      .manager-cell {
        display: none;
      }

      .col-date {
        width: 15%;
      }

      .col-client {
        width: 34%;
      }

      .col-call {
        width: 21%;
      }

      .col-visit {
        width: 30%;
      }

      .lead-compact-meta {
        display: block;
      }
    }
  `,
})
export class LeadsPage {
  private readonly session = inject(SessionService);
  private readonly leadsService = inject(LeadsService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly query = signal('');
  protected readonly notice = signal('');
  protected readonly createDialogOpen = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4];

  protected readonly leadsResource = resource({
    params: () => ({ officeId: this.session.selectedOfficeId() }),
    loader: ({ params }) => this.leadsService.list({ officeId: params.officeId }),
  });

  protected readonly employeesResource = resource({
    loader: () => this.usersService.listEmployees(),
  });

  protected readonly loadError = computed(() => {
    const error = this.leadsResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });

  protected readonly filteredLeads = computed(() => {
    const leads = this.leadsResource.value() ?? [];
    return leads.filter((lead) => matchesLeadSearch(lead, this.query()));
  });
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

  protected formatDateTime = (value: string | null | undefined) => this.i18n.formatDateTime(value);
  protected formatDate = (value: string | null | undefined) => this.i18n.formatDate(value);
  protected readonly officeName = officeName;
  protected readonly workflowTone = workflowTone;

  protected employeeName(employeeId: string | null): string {
    const employees = this.employeesResource.value() ?? [];
    if (!employeeId) return this.i18n.t('common.unassigned');
    return (
      employees.find((employee) => employee.id === employeeId)?.displayName ??
      this.i18n.t('common.unknown')
    );
  }

  protected sourceLabel(lead: MockLead): string {
    return this.i18n.sourceLabel(lead.source);
  }

  protected sourceIcon(lead: MockLead) {
    return LEAD_SOURCE_ICONS[lead.source];
  }

  protected workflowLabel(lead: MockLead): string {
    return this.i18n.workflowLabel(lead.workflowStatus);
  }

  protected firstCallResultLabel(lead: MockLead): string {
    if (!lead.firstCall) return '';
    return this.i18n.firstCallResultLabel(lead.firstCall.result);
  }

  protected async openLead(lead: MockLead): Promise<void> {
    await this.router.navigate(['/crm/leads', lead.id]);
  }

  protected openCreateDialog(): void {
    this.createDialogOpen.set(true);
  }

  protected closeCreateDialog(): void {
    this.createDialogOpen.set(false);
  }

  protected async onLeadCreated(leadId: string): Promise<void> {
    this.createDialogOpen.set(false);
    this.notice.set('');
    await this.leadsResource.reload();
    await this.router.navigate(['/crm/leads', leadId]);
  }
}
