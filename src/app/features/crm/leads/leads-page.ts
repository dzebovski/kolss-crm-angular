import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SessionService } from '../../../core/session/session.service';
import {
  callStatusTone,
  clientStatusTone,
  groupLeadsByYearMonth,
} from '../../../services/crm-mock.helpers';
import type {
  CallStatus,
  ClientStatus,
  LeadEventCategory,
  MockLead,
} from '../../../services/crm-mock.types';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { UiButton } from '../../../ui/button/ui-button';
import { UiAlert } from '../../../ui/feedback/ui-alert';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiChip } from '../../../ui/feedback/ui-chip';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';
import { UiTextField } from '../../../ui/form/ui-text-field';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiUser } from '../../../ui/user/ui-user';
import { CreateLeadDialog } from './create-lead-dialog';
import {
  readLeadsPagePreferences,
  writeLeadsPagePreferences,
  type CallStatusFilterKey,
  type ClientStatusFilterKey,
} from './leads-page-preferences.storage';

@Component({
  selector: 'app-leads-page',
  imports: [
    CreateLeadDialog,
    TranslatePipe,
    UiAlert,
    UiBadge,
    UiButton,
    UiChip,
    UiIcon,
    UiSelect,
    UiTextField,
    UiUser,
  ],
  template: `
    <section class="crm-page" aria-labelledby="leads-title">
      <header class="page-header">
        <div>
          <p class="eyebrow">CRM</p>
          <h1 id="leads-title">{{ 'leads.title' | translate }}</h1>
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
      </header>

      <div class="filters" aria-label="{{ 'leads.filterAria' | translate }}">
        <app-ui-text-field
          class="filter-search"
          [label]="'common.search' | translate"
          type="search"
          [placeholder]="'leads.searchPlaceholder' | translate"
          [(value)]="query"
        />

        <app-ui-select
          [label]="'leads.filter.callStatus' | translate"
          [placeholder]="'leads.filter.all' | translate"
          [options]="callStatusOptions()"
          [(value)]="callStatusFilter"
        />

        <app-ui-select
          [label]="'leads.filter.clientStatus' | translate"
          [placeholder]="'leads.filter.all' | translate"
          [options]="clientStatusOptions()"
          [(value)]="clientStatusFilter"
        />

        <app-ui-select
          [label]="'leads.filter.byManager' | translate"
          [placeholder]="'leads.filter.all' | translate"
          [options]="managerOptions()"
          [(value)]="managerFilter"
        />

        <div class="period-switcher" role="group" [attr.aria-label]="'reports.period' | translate">
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

      @if (activeFilterLabels().length) {
        <div class="filter-chips" aria-live="polite">
          @for (filter of activeFilterLabels(); track filter.kind) {
            <app-ui-chip [label]="filter.label" [removable]="true" (removed)="clearFilter(filter.kind)">
              {{ filter.label }}
            </app-ui-chip>
          }
        </div>
      }

      @if (loadError()) {
        <app-ui-alert tone="danger" [title]="'leads.loadError' | translate">
          {{ loadError() }}
        </app-ui-alert>
      }

      @if (leadsResource.isLoading()) {
        <div class="table-state" aria-live="polite">
          @for (row of skeletonRows; track row) {
            <span></span>
          }
        </div>
      } @else if (!leads().length) {
        <article class="empty-state">
          <app-ui-icon name="inbox" [size]="30" />
          <h2>{{ 'leads.emptyTitle' | translate }}</h2>
          <p>{{ 'leads.emptyHint' | translate }}</p>
        </article>
      } @else {
        <div class="table-panel">
          <table [attr.aria-label]="'leads.tableAria' | translate">
            <colgroup>
              <col class="col-date" />
              <col class="col-client" />
              <col class="col-manager" />
              <col class="col-call" />
              <col class="col-status" />
              <col class="col-comment" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{{ 'common.date' | translate }}</th>
                <th scope="col">{{ 'leads.colClient' | translate }}</th>
                <th scope="col">{{ 'common.manager' | translate }}</th>
                <th scope="col">{{ 'leads.colCall' | translate }}</th>
                <th scope="col">{{ 'common.status' | translate }}</th>
                <th scope="col">{{ 'leads.colComment' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (group of groupedLeads(); track group.key) {
                <tr class="month-row">
                  <th scope="rowgroup" colspan="6">
                    <span>{{ group.label }}</span>
                    <small>{{ 'leads.count' | translate: { count: group.rows.length } }}</small>
                    @if (group.contractTotals.length) {
                      <span class="month-total">
                        @for (total of group.contractTotals; track total.currency) {
                          <span>{{ formatMoney(total.total, total.currency) }}</span>
                        }
                      </span>
                    }
                  </th>
                </tr>

                @for (lead of group.rows; track lead.id) {
                  <tr
                    class="lead-row"
                    tabindex="0"
                    role="link"
                    [attr.aria-label]="'leads.openAria' | translate: { name: lead.name }"
                    (click)="openLead(lead)"
                    (keydown.enter)="openLead(lead)"
                  >
                    <td class="date-cell">
                      <strong>{{ formatDayMonth(lead.sourceCreatedAt) }}</strong>
                      <small>{{ formatTime(lead.sourceCreatedAt) }}</small>
                    </td>
                    <td class="client-cell">
                      <strong>{{ lead.name }}</strong>
                      <small>{{ lead.phone }}</small>
                    </td>
                    <td>
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
                    <td>
                      @if (lead.callStatus; as status) {
                        <app-ui-badge [tone]="callStatusTone(status)">
                          {{ callStatusLabel(status) }}
                        </app-ui-badge>
                      } @else {
                        <span class="muted">{{ 'leads.notRecordedYet' | translate }}</span>
                      }
                    </td>
                    <td>
                      <app-ui-badge [tone]="clientStatusToneForLead(lead)">
                        {{ clientStatusLabelForLead(lead) }}
                      </app-ui-badge>
                    </td>
                    <td class="comment-cell">
                      @if (lead.latestTimelineComment; as latest) {
                        <span [title]="latest.comment">{{ latest.comment }}</span>
                        @if (commentContext(latest.category, latest.statusCode); as context) {
                          <small>{{ context }}</small>
                        }
                      } @else {
                        <span class="muted">—</span>
                      }
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
      <app-create-lead-dialog (dismissed)="closeCreateDialog()" (created)="onLeadCreated($event)" />
    }
  `,
  styles: `
    .crm-page { display: grid; gap: var(--ui-space-5); }
    .page-header { display: flex; align-items: end; justify-content: space-between; gap: var(--ui-space-5); }
    .eyebrow { margin: 0 0 var(--ui-space-1); color: var(--ui-action); font-size: .72rem; font-weight: 800; letter-spacing: .14em; }
    h1 { margin: 0; font-family: var(--ui-font-display), sans-serif; font-size: clamp(1.8rem, 4vw, 2.4rem); }
    .page-actions, .filter-chips { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); }
    .filters { padding: var(--ui-space-4); border: 1px solid var(--ui-border); border-radius: var(--ui-radius-lg); background: var(--ui-surface-raised); display: grid; grid-template-columns: minmax(16rem, 1.4fr) repeat(3, minmax(11rem, 1fr)); gap: var(--ui-space-3); align-items: end; box-shadow: var(--ui-shadow-1); }
    .period-switcher { grid-column: 1 / -1; padding: .1875rem; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-md); background: var(--ui-surface-subtle); display: flex; flex-wrap: wrap; gap: .125rem; width: fit-content; }
    .period-switcher button { min-height: 2rem; padding: 0 var(--ui-space-3); border: 0; border-radius: calc(var(--ui-radius-md) - .1875rem); background: transparent; color: var(--ui-text-muted); cursor: pointer; font-size: .8125rem; font-weight: 700; }
    .period-switcher button.is-active { background: var(--ui-surface-raised); color: var(--ui-action); box-shadow: var(--ui-shadow-1); }
    .table-panel { border: 1px solid var(--ui-border); border-radius: var(--ui-radius-lg); background: var(--ui-surface-raised); box-shadow: var(--ui-shadow-1); overflow-x: auto; }
    table { width: 100%; min-width: 68rem; border-collapse: collapse; table-layout: fixed; font-size: .8125rem; }
    .col-date { width: 9%; } .col-client { width: 18%; } .col-manager { width: 16%; } .col-call { width: 15%; } .col-status { width: 17%; } .col-comment { width: 25%; }
    th, td { padding: .75rem var(--ui-space-3); border-bottom: 1px solid var(--ui-border); overflow: hidden; text-align: left; vertical-align: middle; }
    thead th { color: var(--ui-text-subtle); font-size: .6875rem; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
    .month-row th { background: var(--ui-surface-subtle); color: var(--ui-text); font-size: .875rem; letter-spacing: 0; text-transform: none; }
    .month-row small { margin-left: var(--ui-space-2); color: var(--ui-text-muted); }
    .month-total { float: right; display: inline-flex; gap: var(--ui-space-3); font-weight: 700; }
    .lead-row { cursor: pointer; transition: background var(--ui-duration-fast) var(--ui-ease); }
    .lead-row:hover, .lead-row:focus-visible { background: var(--ui-surface-subtle); outline: none; }
    .lead-row strong, .lead-row small, .comment-cell > span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lead-row small, .muted { color: var(--ui-text-subtle); font-size: .75rem; }
    .date-cell strong { text-transform: capitalize; }
    .comment-cell > span:not(.muted) { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; white-space: normal; line-height: 1.35; }
    .comment-cell small { margin-top: .25rem; }
    .table-state, .empty-state { min-height: 16rem; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-lg); background: var(--ui-surface-raised); display: grid; place-items: center; color: var(--ui-text-muted); }
    .table-state { align-content: center; gap: var(--ui-space-3); padding: var(--ui-space-6); }
    .table-state span { width: min(100%, 52rem); height: 2.5rem; border-radius: var(--ui-radius-md); background: var(--ui-surface-subtle); animation: pulse 1.1s ease-in-out infinite; }
    .empty-state { align-content: center; gap: var(--ui-space-2); text-align: center; }
    .empty-state h2, .empty-state p { margin: 0; }
    @keyframes pulse { 50% { opacity: .5; } }
    @media (max-width: 70rem) { .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 48rem) { .page-header { align-items: start; flex-direction: column; } .filters { grid-template-columns: minmax(0, 1fr); } .period-switcher { grid-column: auto; width: 100%; } .page-actions { width: 100%; } }
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
  protected readonly callStatusFilter = signal<CallStatusFilterKey | ''>(
    this.initialPreferences.callStatusFilter ?? '',
  );
  protected readonly clientStatusFilter = signal<ClientStatusFilterKey | ''>(
    this.initialPreferences.clientStatusFilter ?? '',
  );
  protected readonly managerFilter = signal(this.initialPreferences.managerFilter);
  protected readonly createDialogOpen = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4];
  protected readonly callStatusTone = callStatusTone;

  constructor() {
    effect(() => {
      writeLeadsPagePreferences({
        periodDays: this.periodDays(),
        callStatusFilter: this.callStatusFilter() || null,
        clientStatusFilter: this.clientStatusFilter() || null,
        managerFilter: this.managerFilter(),
      });
    });
  }

  protected readonly periods = computed(() => {
    this.i18n.locale();
    return [
      { label: this.i18n.t('reports.period.week'), days: 7 },
      { label: this.i18n.t('reports.period.month'), days: 30 },
      { label: this.i18n.t('reports.period.40days'), days: 40 },
      { label: this.i18n.t('reports.period.6months'), days: 180 },
      { label: this.i18n.t('reports.period.all'), days: null },
    ];
  });

  protected readonly callStatusOptions = computed((): readonly UiSelectOption[] => {
    this.i18n.locale();
    return (['reached', 'no_answer', 'callback_requested'] as const).map((status) => ({
      value: status,
      label: this.i18n.callStatusLabel(status),
    }));
  });

  protected readonly clientStatusOptions = computed((): readonly UiSelectOption[] => {
    this.i18n.locale();
    return (
      [
        'new_lead',
        'showroom_invited',
        'calculation_in_progress',
        'thinking',
        'closed_lost',
        'contract_signed',
      ] as const
    ).map((status) => ({ value: status, label: this.i18n.clientStatusLabel(status) }));
  });

  protected readonly leadsResource = resource({
    params: () => ({
      officeId: this.session.selectedOfficeId(),
      search: this.query().trim(),
      archived: this.showArchived() ? ('only' as const) : ('active' as const),
      days: this.periodDays(),
      callStatus: this.callStatusFilter() || null,
      clientStatus: this.clientStatusFilter() || null,
      assignedTo: this.managerFilter() || null,
    }),
    loader: ({ params }) => this.leadsService.list(params),
  });

  protected readonly employeesResource = resource({ loader: () => this.usersService.listManagers() });

  protected readonly managerOptions = computed((): readonly UiSelectOption[] => {
    const officeFilter = this.session.officeFilter();
    return (this.employeesResource.value() ?? [])
      .filter(
        (employee) =>
          employee.status === 'active' &&
          employee.role !== 'super_admin' &&
          (officeFilter === 'all' || employee.officeIds.includes(officeFilter)),
      )
      .map((employee) => ({ value: employee.id, label: employee.displayName, userId: employee.id }));
  });

  protected readonly leads = computed(() => this.leadsResource.value() ?? []);
  protected readonly groupedLeads = computed(() => groupLeadsByYearMonth(this.leads()));
  protected readonly loadError = computed(() => {
    const error = this.leadsResource.error();
    return error instanceof Error ? this.i18n.localizeError(error.message) : error ? String(error) : '';
  });

  protected readonly activeFilterLabels = computed(() => {
    const filters: { kind: 'call' | 'client' | 'manager'; label: string }[] = [];
    if (this.callStatusFilter()) {
      filters.push({ kind: 'call', label: this.i18n.callStatusLabel(this.callStatusFilter()) });
    }
    if (this.clientStatusFilter()) {
      filters.push({ kind: 'client', label: this.i18n.clientStatusLabel(this.clientStatusFilter()) });
    }
    if (this.managerFilter()) {
      filters.push({ kind: 'manager', label: this.employeeName(this.managerFilter()) });
    }
    return filters;
  });

  protected callStatusLabel(status: CallStatus): string {
    return this.i18n.callStatusLabel(status);
  }

  protected clientStatusLabel(status: ClientStatus): string {
    return this.i18n.clientStatusLabel(status);
  }

  protected clientStatusLabelForLead(lead: MockLead): string {
    if (lead.clientStatus === 'new_lead' && lead.callStatus) {
      return this.i18n.t('workflow.taken');
    }
    return this.clientStatusLabel(lead.clientStatus);
  }

  protected clientStatusToneForLead(lead: MockLead) {
    if (lead.clientStatus === 'new_lead' && lead.callStatus) return 'info' as const;
    return clientStatusTone(lead.clientStatus);
  }

  protected commentContext(category: LeadEventCategory | null, statusCode: string | null): string {
    if (!statusCode) return '';
    if (category === 'call_status') return this.i18n.callStatusLabel(statusCode);
    if (category === 'client_status') return this.i18n.clientStatusLabel(statusCode);
    return '';
  }

  protected formatDayMonth(value: string): string {
    const locale = { uk: 'uk-UA', pl: 'pl-PL', en: 'en-GB' }[this.i18n.locale()];
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(value));
  }

  protected formatTime(value: string): string {
    const locale = { uk: 'uk-UA', pl: 'pl-PL', en: 'en-GB' }[this.i18n.locale()];
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }

  protected formatMoney(value: number, currency: string): string {
    return this.i18n.formatMoney(value, currency);
  }

  protected employeeName(employeeId: string | null): string {
    if (!employeeId) return this.i18n.t('common.unassigned');
    return (
      (this.employeesResource.value() ?? []).find((employee) => employee.id === employeeId)
        ?.displayName ?? this.i18n.t('common.unassigned')
    );
  }

  protected hasActiveManager(employeeId: string | null): boolean {
    return !!employeeId && (this.employeesResource.value() ?? []).some((employee) => employee.id === employeeId);
  }

  protected clearFilter(kind: 'call' | 'client' | 'manager'): void {
    if (kind === 'call') this.callStatusFilter.set('');
    if (kind === 'client') this.clientStatusFilter.set('');
    if (kind === 'manager') this.managerFilter.set('');
  }

  protected toggleArchived(): void {
    this.showArchived.update((value) => !value);
  }

  protected isSuperAdmin(): boolean {
    return this.auth.profile()?.role === 'super_admin';
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
    await this.leadsResource.reload();
    await this.router.navigate(['/crm/leads', leadId]);
  }
}
