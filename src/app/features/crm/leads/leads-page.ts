import { Component, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { isSuperAdminRole } from '@core/roles/roles';
import { SessionService } from '@core/session/session.service';
import {
  callStatusTone,
  commentDueAtForLead,
  clientStatusTone,
  clientStatusToneForLead,
  groupLeadsByYearMonth,
  leadIsInWork,
  showroomDueAtForLead,
} from '@domain/lead.rules';
import type { CallStatus, ClientStatus, LeadEventCategory, Lead } from '@domain/lead.types';
import { LeadsService } from '@services/leads.service';
import { UsersService } from '@services/users.service';
import { UiButton } from '@ui/button/ui-button';
import { UiAlert } from '@ui/feedback/ui-alert';
import { UiBadge } from '@ui/feedback/ui-badge';
import { UiChip } from '@ui/feedback/ui-chip';
import { UiMultiSelect, type UiMultiSelectOption } from '@ui/form/ui-multi-select';
import { UiSelect, type UiSelectOption } from '@ui/form/ui-select';
import { UiSwitch } from '@ui/form/ui-switch';
import { UiTextField } from '@ui/form/ui-text-field';
import { UiIcon } from '@ui/icon/ui-icon';
import { LinkifiedText } from '@ui/text/linkified-text';
import { UiUser } from '@ui/user/ui-user';
import { CreateLeadDialog } from './create-lead-dialog';
import { closeReasonLabelForLead } from './lead-detail-page.presenter';
import { LeadDueDate } from './lead-due-date';
import { formatLeadDayMonth, formatLeadTime } from './leads-page.presenter';
import {
  readLeadsPagePreferences,
  writeLeadsPagePreferences,
  type CallStatusFilterKey,
  type ClientStatusFilterKey,
} from './leads-page-preferences.storage';
import {
  leadsPageQueryStateFromPreferences,
  parseLeadsPageQuery,
  serializeLeadsPageQuery,
} from './leads-page-query-params';

@Component({
  selector: 'app-leads-page',
  imports: [
    CreateLeadDialog,
    LeadDueDate,
    LinkifiedText,
    TranslatePipe,
    UiAlert,
    UiBadge,
    UiButton,
    UiChip,
    UiIcon,
    UiMultiSelect,
    UiSelect,
    UiSwitch,
    UiTextField,
    UiUser,
  ],
  templateUrl: './leads-page.html',
  styleUrl: './leads-page.scss',
})
export class LeadsPage {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly leadsService = inject(LeadsService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly i18n = inject(I18nService);

  /**
   * Read once instead of binding through `input()`: this page is both the
   * reader and the writer of its query params, so a continuous binding would
   * feed its own writes back in. Same approach as the calendar deep link.
   */
  private readonly linkedFilters = parseLeadsPageQuery(this.route.snapshot.queryParamMap);
  private readonly initialFilters =
    this.linkedFilters ?? leadsPageQueryStateFromPreferences(readLeadsPagePreferences());
  private linkedOfficeApplied = false;

  protected readonly query = signal(this.initialFilters.query);
  /** `query`, 300ms after the last keystroke — what leadsResource actually searches by. */
  protected readonly debouncedQuery = signal(this.initialFilters.query);
  protected readonly showArchived = signal(this.initialFilters.showArchived);
  protected readonly periodDays = signal<number | null>(this.initialFilters.periodDays);
  protected readonly callStatusFilter = signal<readonly CallStatusFilterKey[]>(
    this.initialFilters.callStatusFilter,
  );
  /**
   * `active` is a cohort ("everything except closed/won"), not a concrete
   * status, so it is not one of the checkable `clientStatusOptions` — it has
   * its own switch (see `activeClientsOnly`) instead of living inside this
   * multi-select's value.
   *
   * The two controls are kept **mutually exclusive** on purpose: the API ORs
   * every `clientStatus` value together, so `active` (already "everything but
   * closed/won") combined with any concrete status is either redundant or
   * self-defeating (e.g. `active OR closed_lost` silently undoes the
   * exclusion the switch promises). Two effects below (search "mutual
   * exclusivity") enforce that turning one on clears the other — from either
   * direction, and regardless of whether the change came from the UI or a
   * signal write — so `effectiveClientStatusFilter` never has to reconcile
   * both at once. A query-link/preference already carrying both is resolved
   * the same way at construction, below.
   */
  private readonly initialActiveClientsOnly =
    this.initialFilters.clientStatusFilter.includes('active');
  protected readonly clientStatusFilter = signal<readonly ClientStatusFilterKey[]>(
    this.initialActiveClientsOnly
      ? []
      : this.initialFilters.clientStatusFilter.filter((status) => status !== 'active'),
  );
  protected readonly activeClientsOnly = signal(this.initialActiveClientsOnly);
  protected readonly managerFilter = signal(this.initialFilters.managerFilter);
  protected readonly createDialogOpen = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4];
  protected readonly callStatusTone = callStatusTone;

  /** `active` cohort when its switch is on, otherwise the concrete selection. */
  protected readonly effectiveClientStatusFilter = computed((): readonly ClientStatusFilterKey[] =>
    this.activeClientsOnly() ? ['active'] : this.clientStatusFilter(),
  );

  constructor() {
    // Mutual exclusivity between the client-status multi-select and the
    // "active" switch (see the invariant note on `clientStatusFilter` above).
    // Two one-directional effects instead of a single combined one: each
    // reacts only to the signal *it* clears the other for, so a write that
    // already satisfies the invariant (e.g. clearing the multi-select while
    // "active" is off) is a same-reference no-op and never bounces the other
    // effect.
    effect(() => {
      if (this.clientStatusFilter().length) {
        untracked(() => this.activeClientsOnly.set(false));
      }
    });
    effect(() => {
      if (this.activeClientsOnly() && this.clientStatusFilter().length) {
        untracked(() => this.clientStatusFilter.set([]));
      }
    });

    effect(() => {
      writeLeadsPagePreferences({
        periodDays: this.periodDays(),
        callStatusFilter: this.callStatusFilter(),
        clientStatusFilter: this.effectiveClientStatusFilter(),
        managerFilter: this.managerFilter(),
      });
    });

    // Keeps the address bar in sync so the current view can be shared as a
    // link, and so reload / back restores the same list. `replaceUrl` keeps
    // every filter change out of the browser history.
    effect(() => {
      const queryParams = serializeLeadsPageQuery({
        office: this.session.showOfficeFilter() ? this.session.officeFilter() : null,
        periodDays: this.periodDays(),
        callStatusFilter: this.callStatusFilter(),
        clientStatusFilter: this.effectiveClientStatusFilter(),
        managerFilter: this.managerFilter(),
        query: this.debouncedQuery().trim(),
        showArchived: this.showArchived(),
      });
      void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
    });

    // Offices arrive from `/v1/me`, so a linked office can only be applied
    // once the session context is loaded. An office the user cannot see is
    // ignored: the rest of the link still applies.
    effect(() => {
      const office = this.linkedFilters?.office;
      const context = this.session.officeContext();
      if (!office || this.linkedOfficeApplied || !this.session.loaded() || !context) return;

      this.linkedOfficeApplied = true;
      if (!context.canFilter) return;
      if (office !== 'all' && !context.filterOffices.some((entry) => entry.code === office)) return;
      untracked(() => this.session.setOfficeFilter(office));
    });

    effect((onCleanup) => {
      const value = this.query();
      const timer = setTimeout(() => this.debouncedQuery.set(value), 300);
      onCleanup(() => clearTimeout(timer));
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

  protected readonly callStatusOptions = computed((): readonly UiMultiSelectOption[] => {
    this.i18n.locale();
    return (
      [
        'reached',
        'no_answer',
        'callback_requested',
        'none',
        'callback_undated',
      ] as const satisfies readonly CallStatusFilterKey[]
    ).map((status) => ({ value: status, label: this.callStatusFilterLabel(status) }));
  });

  protected readonly clientStatusOptions = computed((): readonly UiMultiSelectOption[] => {
    this.i18n.locale();
    return (
      [
        'new_lead',
        'in_work',
        'showroom_invited',
        'measurement_scheduled',
        'calculation_in_progress',
        'thinking',
        'postponed',
        'closed_lost',
        'contract_signed',
      ] as const satisfies readonly ClientStatusFilterKey[]
    ).map((status) => ({ value: status, label: this.clientStatusFilterLabel(status) }));
  });

  protected readonly filterSummaryLabel = computed(() => {
    this.i18n.locale();
    return (count: number) => this.i18n.t('leads.filter.selectedCount', { count });
  });

  protected readonly leadsResource = resource({
    params: () => ({
      officeId: this.session.selectedOfficeId(),
      search: this.debouncedQuery().trim(),
      archived: this.showArchived() ? ('only' as const) : ('active' as const),
      days: this.periodDays(),
      callStatus: this.callStatusFilter(),
      clientStatus: this.effectiveClientStatusFilter(),
      assignedTo: this.managerFilter() || null,
    }),
    loader: ({ params }) => this.leadsService.list(params),
  });

  protected readonly employeesResource = resource({
    loader: () => this.usersService.listManagers(),
  });

  protected readonly managerOptions = computed((): readonly UiSelectOption[] => {
    const officeFilter = this.session.officeFilter();
    return (this.employeesResource.value() ?? [])
      .filter(
        (employee) =>
          employee.status === 'active' &&
          !isSuperAdminRole(employee.role) &&
          (officeFilter === 'all' || employee.officeIds.includes(officeFilter)),
      )
      .map((employee) => ({
        value: employee.id,
        label: employee.displayName,
        userId: employee.id,
      }));
  });

  protected readonly leads = computed(() => this.leadsResource.value() ?? []);
  protected readonly groupedLeads = computed(() => groupLeadsByYearMonth(this.leads()));
  protected readonly loadError = computed(() => {
    const error = this.leadsResource.error();
    return error instanceof Error
      ? this.i18n.localizeError(error.message)
      : error
        ? String(error)
        : '';
  });

  protected callStatusLabel(status: CallStatus): string {
    return this.i18n.callStatusLabel(status);
  }

  protected clientStatusLabel(status: ClientStatus): string {
    return this.i18n.clientStatusLabel(status);
  }

  protected clientStatusFilterLabel(status: ClientStatusFilterKey): string {
    if (status === 'in_work') {
      return this.i18n.t('workflow.taken');
    }
    if (status === 'active') {
      return this.i18n.t('leads.filter.clientStatusActive');
    }
    return this.clientStatusLabel(status);
  }

  protected clientStatusFilterTone(status: ClientStatusFilterKey) {
    if (status === 'in_work') {
      return 'info' as const;
    }
    if (status === 'active') {
      return 'success' as const;
    }
    return clientStatusTone(status);
  }

  /**
   * `none`/`callback_undated` are filter-only cohorts (see
   * `CallStatusFilterKey`), never a lead's real `callStatus`, so they need
   * their own label/tone instead of the domain `callStatusLabel`/`callStatusTone`.
   */
  protected callStatusFilterLabel(status: CallStatusFilterKey): string {
    if (status === 'none') {
      return this.i18n.t('leads.filter.callStatusNone');
    }
    if (status === 'callback_undated') {
      return this.i18n.t('leads.filter.callStatusCallbackUndated');
    }
    return this.callStatusLabel(status);
  }

  protected callStatusFilterTone(status: CallStatusFilterKey) {
    if (status === 'none' || status === 'callback_undated') {
      return 'neutral' as const;
    }
    return callStatusTone(status);
  }

  protected clientStatusLabelForLead(lead: Lead): string {
    if (leadIsInWork(lead)) {
      return this.i18n.t('workflow.taken');
    }
    return this.clientStatusLabel(lead.clientStatus);
  }

  protected clientStatusToneForLead(lead: Lead) {
    return clientStatusToneForLead(lead);
  }

  protected closeReasonLabelForLead(lead: Lead): string {
    return closeReasonLabelForLead(lead, (code) => this.i18n.closeReasonLabel(code));
  }

  protected commentContext(category: LeadEventCategory | null, statusCode: string | null): string {
    if (!statusCode) return '';
    if (category === 'call_status') return this.i18n.callStatusLabel(statusCode);
    if (category === 'client_status') return this.i18n.clientStatusLabel(statusCode);
    return '';
  }

  protected formatDayMonth(value: string): string {
    return formatLeadDayMonth(value, this.i18n.locale());
  }

  protected formatTime(value: string): string {
    return formatLeadTime(value, this.i18n.locale());
  }

  protected readonly commentDueAtForLead = commentDueAtForLead;
  protected readonly showroomDueAtForLead = showroomDueAtForLead;

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
    return (
      !!employeeId &&
      (this.employeesResource.value() ?? []).some((employee) => employee.id === employeeId)
    );
  }

  protected removeCallStatus(value: CallStatusFilterKey): void {
    this.callStatusFilter.update((values) => values.filter((v) => v !== value));
  }

  protected removeClientStatus(value: ClientStatusFilterKey): void {
    this.clientStatusFilter.update((values) => values.filter((v) => v !== value));
  }

  protected clearManagerFilter(): void {
    this.managerFilter.set('');
  }

  protected toggleArchived(): void {
    this.showArchived.update((value) => !value);
  }

  protected isSuperAdmin(): boolean {
    return isSuperAdminRole(this.auth.profile()?.role);
  }

  protected async openLead(lead: Lead): Promise<void> {
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
