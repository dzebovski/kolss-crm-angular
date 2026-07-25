import { Component, computed, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SessionService } from '@core/session/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { OFFICE_CONFIG } from '@core/office/office.config';
import {
  ASSIGNABLE_ROLES,
  DEFAULT_ROLE,
  isSuperAdminRole,
  ROLE_CURATOR,
  ROLE_OFFICE_ADMIN,
  ROLE_OFFICE_MEMBER,
  ROLE_SUPER_ADMIN,
} from '@core/roles/roles';
import type { UserRole } from '@models/database';
import { formatDateTime } from '@domain/lead.rules';
import type { OfficeFilter } from '@domain/office.types';
import { UsersService, type CrmEmployee } from '@services/users.service';
import { UiAlert } from '@ui/feedback/ui-alert';
import { UiBadge, type UiBadgeTone } from '@ui/feedback/ui-badge';
import { UiButton } from '@ui/button/ui-button';
import { UiIcon } from '@ui/icon/ui-icon';
import { UiUser } from '@ui/user/ui-user';
import { UiSelect, type UiSelectOption } from '@ui/form/ui-select';
import { UiTextField } from '@ui/form/ui-text-field';

@Component({
  selector: 'app-accounts-page',
  imports: [UiAlert, UiBadge, UiButton, UiIcon, UiSelect, UiTextField, UiUser, TranslatePipe],
  templateUrl: './accounts-page.html',
  styleUrl: './accounts-page.scss',
})
export class AccountsPage {
  private readonly usersService = inject(UsersService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly query = signal('');
  protected readonly officeFilter = signal<OfficeFilter>('all');
  protected readonly roleFilter = signal('all');
  protected readonly notice = signal('');
  protected readonly actionError = signal('');
  protected readonly showCreatePanel = signal(false);
  protected readonly creating = signal(false);
  protected readonly createEmail = signal('');
  protected readonly createDisplayName = signal('');
  protected readonly createPassword = signal('');
  protected readonly createPasswordConfirm = signal('');
  protected readonly createRole = signal<UserRole>(DEFAULT_ROLE);
  protected readonly selectedOfficeIds = signal<string[]>([]);

  protected readonly formatDateTime = formatDateTime;
  protected roleLabel = (role: string) => this.i18n.roleLabel(role);
  protected readonly officeOptions = computed((): readonly UiSelectOption[] => [
    { value: 'all', label: this.i18n.t('office.all') },
    { value: OFFICE_CONFIG.kyiv.id, label: this.i18n.t(OFFICE_CONFIG.kyiv.nameKey) },
    { value: OFFICE_CONFIG.warsaw.id, label: this.i18n.t(OFFICE_CONFIG.warsaw.nameKey) },
  ]);
  protected readonly roleOptions = computed((): readonly UiSelectOption[] => [
    { value: 'all', label: this.i18n.t('role.all') },
    { value: ROLE_SUPER_ADMIN, label: this.i18n.roleLabel(ROLE_SUPER_ADMIN) },
    { value: ROLE_CURATOR, label: this.i18n.roleLabel(ROLE_CURATOR) },
    { value: ROLE_OFFICE_ADMIN, label: this.i18n.roleLabel(ROLE_OFFICE_ADMIN) },
    { value: ROLE_OFFICE_MEMBER, label: this.i18n.roleLabel(ROLE_OFFICE_MEMBER) },
  ]);
  protected readonly assignableRoleOptions = computed((): readonly UiSelectOption[] =>
    ASSIGNABLE_ROLES.map((role) => ({ value: role, label: this.i18n.roleLabel(role) })),
  );
  protected readonly tableColumns = computed(() => [
    this.i18n.t('accounts.employee'),
    'Email',
    this.i18n.t('common.role'),
    this.i18n.t('common.office'),
    this.i18n.t('common.status'),
    this.i18n.t('accounts.lastActivity'),
    this.i18n.t('common.actions'),
  ]);

  protected readonly availableOffices = computed(
    () => this.session.officeContext()?.offices ?? this.session.offices(),
  );

  protected readonly employeesResource = resource({
    loader: async () => {
      const [active, inactive] = await Promise.all([
        this.usersService.listEmployees(),
        this.usersService.listInactiveEmployees(),
      ]);
      return { active, inactive };
    },
  });

  protected readonly loadError = computed(() => {
    const error = this.employeesResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });

  protected readonly employees = computed(() => this.employeesResource.value()?.active ?? []);
  protected readonly inactiveEmployees = computed(
    () => this.employeesResource.value()?.inactive ?? [],
  );

  protected readonly hasActiveFilters = computed(
    () =>
      this.query().trim() !== '' || this.officeFilter() !== 'all' || this.roleFilter() !== 'all',
  );

  protected readonly superAdmins = computed(() =>
    this.employees().filter((employee) => isSuperAdminRole(employee.role)),
  );

  protected readonly officeAdmins = computed(() =>
    this.employees().filter(
      (employee) => employee.role === ROLE_OFFICE_ADMIN || employee.role === ROLE_CURATOR,
    ),
  );

  protected readonly kyivManagers = computed(() =>
    this.employees().filter(
      (employee) =>
        employee.role === ROLE_OFFICE_MEMBER && employee.officeIds.includes(OFFICE_CONFIG.kyiv.id),
    ),
  );

  protected readonly warsawManagers = computed(() =>
    this.employees().filter(
      (employee) =>
        employee.role === ROLE_OFFICE_MEMBER &&
        employee.officeIds.includes(OFFICE_CONFIG.warsaw.id),
    ),
  );

  protected readonly employeeSections = computed(() => [
    {
      id: 'accounts-super-admins',
      title: this.i18n.t('accounts.section.superAdmin'),
      employees: this.superAdmins(),
    },
    {
      id: 'accounts-office-admins',
      title: this.i18n.t('accounts.section.officeAdmins'),
      employees: this.officeAdmins(),
    },
    {
      id: 'accounts-kyiv-managers',
      title: this.i18n.t('accounts.section.managersKyiv'),
      employees: this.kyivManagers(),
    },
    {
      id: 'accounts-warsaw-managers',
      title: this.i18n.t('accounts.section.managersWarsaw'),
      employees: this.warsawManagers(),
    },
  ]);

  protected readonly filteredEmployees = computed(() => this.filterEmployees(this.employees()));

  protected readonly filteredInactiveEmployees = computed(() =>
    this.filterEmployees(this.inactiveEmployees()),
  );

  private filterEmployees(employees: readonly CrmEmployee[]): readonly CrmEmployee[] {
    const query = this.query().trim().toLocaleLowerCase('uk-UA');
    const office = this.officeFilter();
    const role = this.roleFilter();
    return employees.filter((employee) => {
      const matchesQuery =
        !query ||
        `${employee.displayName} ${employee.email ?? ''} ${employee.id}`
          .toLocaleLowerCase('uk-UA')
          .includes(query);
      const matchesOffice = office === 'all' || employee.officeIds.includes(office);
      const matchesRole = role === 'all' || employee.role === role;
      return matchesQuery && matchesOffice && matchesRole;
    });
  }

  protected officeLabels(employee: CrmEmployee): string {
    return employee.officeIds.map((officeId) => this.officeLabel(officeId)).join(', ') || '—';
  }

  protected officeLabel(code: string): string {
    return this.i18n.officeFilterLabel(code);
  }

  protected statusTone(employee: CrmEmployee): UiBadgeTone {
    return employee.status === 'active' ? 'success' : 'warning';
  }

  protected isOfficeSelected(officeId: string): boolean {
    return this.selectedOfficeIds().includes(officeId);
  }

  protected toggleOffice(officeId: string): void {
    this.selectedOfficeIds.update((ids) =>
      ids.includes(officeId) ? ids.filter((id) => id !== officeId) : [...ids, officeId],
    );
  }

  protected toggleCreatePanel(): void {
    this.showCreatePanel.update((open) => !open);
    this.actionError.set('');
  }

  protected resetCreateForm(): void {
    this.createEmail.set('');
    this.createDisplayName.set('');
    this.createPassword.set('');
    this.createPasswordConfirm.set('');
    this.createRole.set(DEFAULT_ROLE);
    this.selectedOfficeIds.set([]);
    this.actionError.set('');
  }

  protected async submitCreate(): Promise<void> {
    this.actionError.set('');
    this.creating.set(true);
    try {
      await this.usersService.createEmployee({
        email: this.createEmail().trim(),
        displayName: this.createDisplayName().trim(),
        password: this.createPassword(),
        passwordConfirm: this.createPasswordConfirm(),
        role: this.createRole(),
        officeIds: this.selectedOfficeIds(),
      });
      this.notice.set('Акаунт створено.');
      this.resetCreateForm();
      this.showCreatePanel.set(false);
      this.employeesResource.reload();
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'Не вдалося створити акаунт');
    } finally {
      this.creating.set(false);
    }
  }

  protected async openEmployee(employee: CrmEmployee): Promise<void> {
    await this.router.navigate(['/crm/accounts', employee.id]);
  }
}
