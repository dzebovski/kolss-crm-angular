import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/session/session.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  groupLeadsByYearMonth,
  LEAD_SOURCE_ICONS,
  workflowTone,
} from '../../../services/crm-mock.helpers';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import type { MockLead } from '../../../services/crm-mock.types';
import { UiAlert } from '../../../ui/feedback/ui-alert';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiChip } from '../../../ui/feedback/ui-chip';
import { UiButton } from '../../../ui/button/ui-button';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiUser } from '../../../ui/user/ui-user';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';
import { UiTextField } from '../../../ui/form/ui-text-field';
import { CreateLeadDialog } from './create-lead-dialog';
import {
  readLeadsPagePreferences,
  writeLeadsPagePreferences,
  type WorkflowFilterKey,
} from './leads-page-preferences.storage';

const VISIT_STATUSES = new Set(['visit_scheduled', 'visit_rescheduled', 'visit_completed']);

@Component({
  selector: 'app-leads-page',
  imports: [
    CreateLeadDialog,
    UiAlert,
    UiBadge,
    UiButton,
    UiChip,
    UiIcon,
    UiSelect,
    UiTextField,
    UiUser,
    TranslatePipe,
  ],
  template: `
    <section class="crm-page" aria-labelledby="leads-title">
      <header class="leads-overview">
        <div class="leads-overview__primary">
          <h1 id="leads-title">{{ 'leads.title' | translate }}</h1>

          <app-ui-text-field
            class="leads-search"
            [label]="'common.search' | translate"
            type="search"
            [placeholder]="'leads.searchPlaceholder' | translate"
            [(value)]="query"
          />

          <div class="manager-filter-bar">
            <app-ui-select
              class="manager-filter-select"
              [label]="'leads.filter.byManager' | translate"
              [placeholder]="'common.manager' | translate"
              [options]="managerOptions()"
              [(value)]="managerFilter"
            />
            @if (managerFilter(); as selectedManagerId) {
              <app-ui-chip
                class="manager-filter-chip"
                [label]="employeeName(selectedManagerId)"
                [removable]="true"
                (removed)="clearManagerFilter()"
              >
                {{ employeeName(selectedManagerId) }}
              </app-ui-chip>
            }
          </div>

          <div class="status-filter-bar">
            <div
              class="period-switcher period-switcher--status"
              role="group"
              [attr.aria-label]="'leads.filterAria' | translate"
            >
              @for (filter of workflowFilters(); track filter.key ?? 'all') {
                <button
                  type="button"
                  [class.is-active]="workflowFilter() === filter.key"
                  [attr.aria-pressed]="workflowFilter() === filter.key"
                  (click)="selectWorkflowFilter(filter.key)"
                >
                  {{ filter.label }}
                </button>
              }
            </div>
          </div>
        </div>

        <div class="leads-overview__secondary">
          <div class="page-actions">
            <app-ui-button (pressed)="openCreateDialog()">
              <app-ui-icon name="add" [size]="17" />
              {{ 'lead.create' | translate }}
            </app-ui-button>
            <app-ui-button variant="secondary" (pressed)="leadsResource.reload()">
              <app-ui-icon name="history" [size]="17" />
              {{ 'leads.refresh' | translate }}
            </app-ui-button>
            @if (isSuperAdmin()) {
              <app-ui-button variant="secondary" (pressed)="toggleArchived()">
                <app-ui-icon name="archive" [size]="17" />
                {{
                  showArchived()
                    ? ('leads.showActive' | translate)
                    : ('leads.showArchived' | translate)
                }}
              </app-ui-button>
            }
          </div>

          <div
            class="period-switcher period-switcher--range"
            role="group"
            [attr.aria-label]="'reports.period' | translate"
          >
            @for (period of periods(); track period.days ?? 'all') {
              <button
                type="button"
                [class.is-active]="periodDays() === period.days"
                [attr.aria-pressed]="periodDays() === period.days"
                (click)="periodDays.set(period.days)"
              >
                {{ period.label }}
              </button>
            }
          </div>
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

      @if (leadsResource.isLoading()) {
        <div class="table-state" aria-live="polite">
          @for (row of skeletonRows; track row) {
            <span></span>
          }
        </div>
      } @else {
        <div class="leads-table-panel">
          @if (!filteredLeads().length) {
            <article class="empty-state empty-state--inset">
              <app-ui-icon name="inbox" [size]="28" />
              <h2>{{ 'leads.emptyTitle' | translate }}</h2>
              <p>{{ 'leads.emptyHint' | translate }}</p>
            </article>
          } @else {
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
                  <th class="call-heading" scope="col">{{ 'common.status' | translate }}</th>
                  <th class="source-heading" scope="col">{{ 'leads.colSource' | translate }}</th>
                  <th class="manager-heading" scope="col">{{ 'common.manager' | translate }}</th>
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
                      <td class="call-cell" [attr.data-label]="'common.status' | translate">
                        @if (lead.close; as close) {
                          @if (close.comment.trim()) {
                            <span class="call-cell__comment" [attr.title]="close.comment">{{
                              close.comment
                            }}</span>
                            <small
                              >{{ closeReasonLabel(lead) }} ·
                              {{ formatDateTime(close.closedAt) }}</small
                            >
                          } @else {
                            <span>{{ closeReasonLabel(lead) }}</span>
                            <small>{{ formatDateTime(close.closedAt) }}</small>
                          }
                        } @else if (lead.firstCall; as call) {
                          @if (call.comment.trim()) {
                            <span class="call-cell__comment" [attr.title]="call.comment">{{
                              call.comment
                            }}</span>
                            <small
                              >{{ firstCallResultLabel(lead) }} ·
                              {{ formatDateTime(call.date) }}</small
                            >
                          } @else {
                            <span>{{ firstCallResultLabel(lead) }}</span>
                            <small>{{ formatDateTime(call.date) }}</small>
                          }
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
                      <td class="manager-cell" [attr.data-label]="'common.manager' | translate">
                        @if (hasActiveManager(lead.assignedToId)) {
                          <app-ui-user
                            [userId]="lead.assignedToId!"
                            [name]="employeeName(lead.assignedToId)"
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
          }
        </div>
      }
    </section>

    @if (createDialogOpen()) {
      <app-create-lead-dialog (dismissed)="closeCreateDialog()" (created)="onLeadCreated($event)" />
    }
  `,
  styles: `
    .crm-page {
      display: grid;
      gap: var(--ui-space-5);
    }

    .leads-overview {
      display: grid;
      grid-template-columns: minmax(30rem, 1fr) auto;
      gap: clamp(var(--ui-space-8), 5vw, var(--ui-space-16));
      align-items: end;
    }

    .leads-overview__primary,
    .leads-overview__secondary {
      min-width: 0;
      display: grid;
      gap: var(--ui-space-3);
    }

    .leads-overview__secondary {
      justify-items: end;
      align-self: end;
    }

    h1 {
      margin: 0;
      font-family: var(--ui-font-display), sans-serif;
      font-size: 2rem;
      letter-spacing: 0;
    }

    .leads-search {
      width: min(100%, 28rem);
    }

    .page-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--ui-space-2);
      white-space: nowrap;
    }

    .period-switcher {
      padding: 0.1875rem;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-subtle);
      display: flex;
      gap: 0.125rem;
    }

    .period-switcher button {
      min-height: 2rem;
      min-width: 5rem;
      padding: 0 var(--ui-space-3);
      border: 0;
      border-radius: calc(var(--ui-radius-md) - 0.1875rem);
      background: transparent;
      color: var(--ui-text-muted);
      cursor: pointer;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .period-switcher button.is-active {
      background: var(--ui-surface-raised);
      color: var(--ui-action);
      box-shadow: var(--ui-shadow-1);
    }

    .period-switcher button:hover:not(.is-active) {
      background: var(--ui-surface-muted);
      color: var(--ui-text);
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

    .leads-table-panel {
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
    }

    .status-filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ui-space-2);
    }

    .manager-filter-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--ui-space-3);
    }

    .manager-filter-select {
      width: min(100%, 18rem);
    }

    /* UiSelect keeps a hint/message slot under the control; lift the chip to the trigger. */
    .manager-filter-chip {
      margin-bottom: calc(0.9375rem + var(--ui-space-2));
    }

    .period-switcher--status {
      flex-wrap: wrap;
    }

    .period-switcher--status button {
      min-width: auto;
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
      width: 16%;
    }

    .col-call {
      width: 28%;
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
      height: auto;
      min-height: 3.875rem;
      line-height: 1.2;
    }

    .call-cell {
      vertical-align: middle;
    }

    .lead-row strong,
    .lead-row span,
    .lead-row small {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lead-row .call-cell__comment {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: normal;
      word-break: break-word;
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

    .empty-state--inset {
      min-height: 14rem;
      border: 0;
      border-radius: 0;
      box-shadow: none;
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
      .leads-overview {
        grid-template-columns: minmax(0, 1fr);
      }

      .leads-overview__secondary {
        justify-items: start;
      }

      .page-actions {
        justify-content: flex-start;
      }

      .period-switcher--range {
        flex-wrap: wrap;
      }

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
        width: 22%;
      }

      .col-call {
        width: 33%;
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
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly leadsService = inject(LeadsService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  private readonly initialPreferences = readLeadsPagePreferences();

  protected readonly query = signal('');
  protected readonly showArchived = signal(false);
  protected readonly periodDays = signal<number | null>(this.initialPreferences.periodDays);
  protected readonly workflowFilter = signal<WorkflowFilterKey | null>(
    this.initialPreferences.workflowFilter,
  );
  /** Empty string = no manager filter (matches UiSelect empty value). */
  protected readonly managerFilter = signal('');
  protected readonly notice = signal('');
  protected readonly createDialogOpen = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4];

  constructor() {
    effect(() => {
      writeLeadsPagePreferences({
        periodDays: this.periodDays(),
        workflowFilter: this.workflowFilter(),
      });
    });
  }

  protected readonly periods = computed(() => {
    this.i18n.locale();
    const options: { label: string; days: number | null }[] = [
      { label: this.i18n.t('reports.period.week'), days: 7 },
      { label: this.i18n.t('reports.period.month'), days: 30 },
      { label: this.i18n.t('reports.period.40days'), days: 40 },
      { label: this.i18n.t('reports.period.6months'), days: 180 },
      { label: this.i18n.t('reports.period.all'), days: null },
    ];
    return options;
  });

  protected readonly workflowFilters = computed(() => {
    this.i18n.locale();
    const options: { key: WorkflowFilterKey | null; label: string }[] = [
      { key: null, label: this.i18n.t('leads.filter.all') },
      { key: 'new', label: this.i18n.t('leads.filter.new') },
      { key: 'first_call_done', label: this.i18n.t('leads.filter.firstCall') },
      { key: 'visit', label: this.i18n.t('leads.filter.visit') },
      { key: 'closed', label: this.i18n.t('leads.filter.closed') },
      { key: 'successful', label: this.i18n.t('leads.filter.contract') },
    ];
    return options;
  });

  protected readonly leadsResource = resource({
    params: () => ({
      officeId: this.session.selectedOfficeId(),
      search: this.query().trim(),
      archived: this.showArchived() ? ('only' as const) : ('active' as const),
      days: this.periodDays(),
    }),
    loader: ({ params }) => this.leadsService.list(params),
  });

  protected readonly employeesResource = resource({
    loader: () => this.usersService.listManagers(),
  });

  protected readonly managerOptions = computed((): readonly UiSelectOption[] => {
    const officeFilter = this.session.officeFilter();
    const employees = this.employeesResource.value() ?? [];
    return employees
      .filter(
        (employee) =>
          employee.status === 'active' &&
          employee.role !== 'super_admin' &&
          (officeFilter === 'all' || employee.officeIds.includes(officeFilter)),
      )
      .map((employee) => ({
        value: employee.id,
        label: employee.displayName,
        userId: employee.id,
      }));
  });

  protected readonly loadError = computed(() => {
    const error = this.leadsResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });

  protected readonly filteredLeads = computed(() => {
    let leads = this.leadsResource.value() ?? [];
    const filter = this.workflowFilter();
    if (filter) {
      leads = leads.filter((lead) => this.matchesWorkflowFilter(lead, filter));
    }
    const managerId = this.managerFilter();
    if (managerId) {
      leads = leads.filter((lead) => lead.assignedToId === managerId);
    }
    return leads;
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
  protected officeName = (code: string) => this.i18n.officeFilterLabel(code);
  protected readonly workflowTone = workflowTone;
  protected readonly isSuperAdmin = () => this.auth.profile()?.role === 'super_admin';

  protected selectWorkflowFilter(key: WorkflowFilterKey | null): void {
    this.workflowFilter.set(key);
  }

  protected clearManagerFilter(): void {
    this.managerFilter.set('');
  }

  protected toggleArchived(): void {
    this.showArchived.update((value) => !value);
  }

  private matchesWorkflowFilter(lead: MockLead, filter: WorkflowFilterKey): boolean {
    switch (filter) {
      case 'new':
        return lead.workflowStatus === 'new';
      case 'first_call_done':
        return lead.workflowStatus === 'first_call_done';
      case 'visit':
        return VISIT_STATUSES.has(lead.workflowStatus);
      case 'closed':
        return lead.workflowStatus === 'closed';
      case 'successful':
        return lead.workflowStatus === 'successful';
    }
  }

  protected employeeName(employeeId: string | null): string {
    const employees = this.employeesResource.value() ?? [];
    if (!employeeId) return this.i18n.t('common.unassigned');
    return (
      employees.find((employee) => employee.id === employeeId)?.displayName ??
      this.i18n.t('common.unassigned')
    );
  }

  protected hasActiveManager(employeeId: string | null): boolean {
    if (!employeeId) return false;
    return (this.employeesResource.value() ?? []).some((employee) => employee.id === employeeId);
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

  protected closeReasonLabel(lead: MockLead): string {
    if (!lead.close) return '';
    return this.i18n.closeReasonLabel(lead.close.reason);
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
