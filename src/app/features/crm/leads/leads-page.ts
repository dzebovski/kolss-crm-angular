import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';

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
import { UiTextField } from '@ui/form/ui-text-field';
import { UiIcon } from '@ui/icon/ui-icon';
import { LinkifiedText } from '@ui/text/linkified-text';
import { UiUser } from '@ui/user/ui-user';
import { CreateLeadDialog } from './create-lead-dialog';
import { LeadDueDate } from './lead-due-date';
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
  protected readonly i18n = inject(I18nService);

  private readonly initialPreferences = readLeadsPagePreferences();
  protected readonly query = signal('');
  /** `query`, 300ms after the last keystroke — what leadsResource actually searches by. */
  protected readonly debouncedQuery = signal('');
  protected readonly showArchived = signal(false);
  protected readonly periodDays = signal<number | null>(this.initialPreferences.periodDays);
  protected readonly callStatusFilter = signal<readonly CallStatusFilterKey[]>(
    this.initialPreferences.callStatusFilter,
  );
  protected readonly clientStatusFilter = signal<readonly ClientStatusFilterKey[]>(
    this.initialPreferences.clientStatusFilter,
  );
  protected readonly managerFilter = signal(this.initialPreferences.managerFilter);
  protected readonly createDialogOpen = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4];
  protected readonly callStatusTone = callStatusTone;

  constructor() {
    effect(() => {
      writeLeadsPagePreferences({
        periodDays: this.periodDays(),
        callStatusFilter: this.callStatusFilter(),
        clientStatusFilter: this.clientStatusFilter(),
        managerFilter: this.managerFilter(),
      });
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
    return (['reached', 'no_answer', 'callback_requested'] as const).map((status) => ({
      value: status,
      label: this.i18n.callStatusLabel(status),
    }));
  });

  protected readonly clientStatusOptions = computed((): readonly UiMultiSelectOption[] => {
    this.i18n.locale();
    return (
      [
        'new_lead',
        'in_work',
        'showroom_invited',
        'calculation_in_progress',
        'thinking',
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
      clientStatus: this.clientStatusFilter(),
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
    return this.clientStatusLabel(status);
  }

  protected clientStatusFilterTone(status: ClientStatusFilterKey) {
    if (status === 'in_work') {
      return 'info' as const;
    }
    return clientStatusTone(status);
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

  protected commentContext(category: LeadEventCategory | null, statusCode: string | null): string {
    if (!statusCode) return '';
    if (category === 'call_status') return this.i18n.callStatusLabel(statusCode);
    if (category === 'client_status') return this.i18n.clientStatusLabel(statusCode);
    return '';
  }

  protected formatDayMonth(value: string): string {
    const locale = { uk: 'uk-UA', pl: 'pl-PL', en: 'en-GB' }[this.i18n.locale()];
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(
      new Date(value),
    );
  }

  protected formatTime(value: string): string {
    const locale = { uk: 'uk-UA', pl: 'pl-PL', en: 'en-GB' }[this.i18n.locale()];
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
      new Date(value),
    );
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
