import { Component, computed, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SessionService } from '../../../core/session/session.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ASSIGNABLE_ROLES } from '../../../core/roles/roles';
import type { UserRole } from '../../../models/database';
import { formatDateTime } from '../../../services/crm-mock.helpers';
import { UsersService, type CrmEmployee } from '../../../services/users.service';
import type { OfficeFilter } from '../../../services/crm-mock.types';
import { UiAlert } from '../../../ui/feedback/ui-alert';
import { UiBadge, type UiBadgeTone } from '../../../ui/feedback/ui-badge';
import { UiButton } from '../../../ui/button/ui-button';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiUser } from '../../../ui/user/ui-user';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';
import { UiTextField } from '../../../ui/form/ui-text-field';

@Component({
  selector: 'app-accounts-page',
  imports: [UiAlert, UiBadge, UiButton, UiIcon, UiSelect, UiTextField, UiUser, TranslatePipe],
  template: `
    <section class="accounts-page" aria-labelledby="accounts-title">
      <header class="page-header">
        <div>
          <p class="page-kicker">Access management</p>
          <h1 id="accounts-title">{{ 'accounts.title' | translate }}</h1>
          <p>{{ 'accounts.subtitle' | translate }}</p>
        </div>
        <app-ui-button (pressed)="toggleCreatePanel()">
          <app-ui-icon [name]="showCreatePanel() ? 'close' : 'add'" [size]="17" />
          {{ showCreatePanel() ? ('common.cancel' | translate) : ('accounts.create' | translate) }}
        </app-ui-button>
      </header>

      @if (loadError()) {
        <app-ui-alert tone="danger" [title]="'accounts.loadError' | translate">
          {{ loadError() }}
        </app-ui-alert>
      }

      @if (actionError()) {
        <app-ui-alert tone="danger" [title]="'common.error' | translate">
          {{ actionError() }}
        </app-ui-alert>
      }

      @if (notice()) {
        <div class="notice" role="status">
          <app-ui-icon name="info" [size]="18" />
          {{ notice() }}
        </div>
      }

      @if (showCreatePanel()) {
        <section class="create-panel" aria-labelledby="create-account-title">
          <h2 id="create-account-title">Новий акаунт</h2>
          <div class="create-form">
            <app-ui-text-field
              label="Email"
              type="email"
              autocomplete="email"
              [(value)]="createEmail"
            />
            <app-ui-text-field
              label="Імʼя"
              autocomplete="name"
              [(value)]="createDisplayName"
            />
            <app-ui-text-field
              label="Пароль"
              type="password"
              autocomplete="new-password"
              [(value)]="createPassword"
            />
            <app-ui-text-field
              label="Підтвердження пароля"
              type="password"
              autocomplete="new-password"
              [(value)]="createPasswordConfirm"
            />
            <app-ui-select
              label="Роль"
              [options]="assignableRoleOptions()"
              [(value)]="createRole"
            />
            <fieldset class="office-fieldset">
              <legend>Офіси</legend>
              @for (office of availableOffices(); track office.id) {
                <label class="office-check">
                  <input
                    type="checkbox"
                    [checked]="isOfficeSelected(office.id)"
                    (change)="toggleOffice(office.id)"
                  />
                  {{ officeLabel(office.code) }}
                </label>
              }
            </fieldset>
          </div>
          <div class="create-actions">
            <app-ui-button variant="secondary" (pressed)="resetCreateForm()">
              Очистити
            </app-ui-button>
            <app-ui-button [disabled]="creating()" (pressed)="submitCreate()">
              {{ creating() ? 'Створення…' : 'Створити' }}
            </app-ui-button>
          </div>
        </section>
      }

      <div class="filters">
        <app-ui-text-field
          label="Пошук"
          type="search"
          placeholder="Імʼя, email або ID"
          [(value)]="query"
        />
        <app-ui-select [label]="'common.office' | translate" [options]="officeOptions()" [(value)]="officeFilter" />
        <app-ui-select [label]="'common.role' | translate" [options]="roleOptions()" [(value)]="roleFilter" />
      </div>

      @if (employeesResource.isLoading()) {
        <section class="accounts-table-panel" aria-label="Список співробітників">
          <p class="loading-cell">Завантаження…</p>
        </section>
      } @else if (hasActiveFilters()) {
        <section class="accounts-table-panel" aria-label="Список співробітників">
          <table class="accounts-table">
            <colgroup>
              <col class="col-employee" />
              <col class="col-email" />
              <col class="col-role" />
              <col class="col-office" />
              <col class="col-status" />
              <col class="col-activity" />
              <col class="col-actions" />
            </colgroup>
            <thead>
              <tr>
                @for (column of tableColumns(); track column) {
                  <th>{{ column }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (employee of filteredEmployees(); track employee.id) {
                <tr>
                  <td class="cell-employee">
                    <app-ui-user
                      [userId]="employee.id"
                      [name]="employee.displayName"
                      size="sm"
                    />
                    <small>{{ employee.id }}</small>
                  </td>
                  <td class="cell-truncate">{{ employee.email ?? '—' }}</td>
                  <td>{{ roleLabel(employee.role) }}</td>
                  <td class="cell-truncate">{{ officeLabels(employee) }}</td>
                  <td>
                    <app-ui-badge [tone]="statusTone(employee)">
                      {{ employee.status === 'active' ? 'Активний' : 'Неактивний' }}
                    </app-ui-badge>
                  </td>
                  <td class="cell-activity">{{ formatDateTime(employee.lastActiveAt) }}</td>
                  <td class="cell-actions">
                    <app-ui-button
                      variant="secondary"
                      size="small"
                      (pressed)="openEmployee(employee)"
                    >
                      {{ 'common.profile' | translate }}
                    </app-ui-button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="empty-cell">
                    Немає співробітників за поточними фільтрами.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      } @else {
        <div class="accounts-sections">
          @for (section of employeeSections(); track section.id) {
            <section
              class="accounts-table-panel"
              [attr.aria-labelledby]="section.id"
            >
              <header class="section-header">
                <h2 [id]="section.id">{{ section.title }}</h2>
                <span>{{ section.employees.length }}</span>
              </header>
              <table class="accounts-table">
                <colgroup>
                  <col class="col-employee" />
                  <col class="col-email" />
                  <col class="col-role" />
                  <col class="col-office" />
                  <col class="col-status" />
                  <col class="col-activity" />
                  <col class="col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    @for (column of tableColumns(); track column) {
                      <th>{{ column }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (employee of section.employees; track employee.id) {
                    <tr>
                      <td class="cell-employee">
                        <app-ui-user
                          [userId]="employee.id"
                          [name]="employee.displayName"
                          size="sm"
                        />
                        <small>{{ employee.id }}</small>
                      </td>
                      <td class="cell-truncate">{{ employee.email ?? '—' }}</td>
                      <td>{{ roleLabel(employee.role) }}</td>
                      <td class="cell-truncate">{{ officeLabels(employee) }}</td>
                      <td>
                        <app-ui-badge [tone]="statusTone(employee)">
                          {{ employee.status === 'active' ? 'Активний' : 'Неактивний' }}
                        </app-ui-badge>
                      </td>
                      <td class="cell-activity">{{ formatDateTime(employee.lastActiveAt) }}</td>
                      <td class="cell-actions">
                        <app-ui-button
                          variant="secondary"
                          size="small"
                          (pressed)="openEmployee(employee)"
                        >
                          {{ 'common.profile' | translate }}
                        </app-ui-button>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="7" class="empty-cell">Немає співробітників.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </section>
          }
        </div>
      }

      @if (!employeesResource.isLoading()) {
        <section
          class="accounts-table-panel accounts-table-panel--inactive"
          aria-labelledby="accounts-inactive"
        >
          <header class="section-header">
            <h2 id="accounts-inactive">Деактивовані акаунти</h2>
            <span>{{ filteredInactiveEmployees().length }}</span>
          </header>
          <table class="accounts-table">
            <colgroup>
              <col class="col-employee" />
              <col class="col-email" />
              <col class="col-role" />
              <col class="col-office" />
              <col class="col-status" />
              <col class="col-activity" />
              <col class="col-actions" />
            </colgroup>
            <thead>
              <tr>
                @for (column of tableColumns(); track column) {
                  <th>{{ column }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (employee of filteredInactiveEmployees(); track employee.id) {
                <tr>
                  <td class="cell-employee">
                    <app-ui-user
                      [userId]="employee.id"
                      [name]="employee.displayName"
                      size="sm"
                    />
                    <small>{{ employee.id }}</small>
                  </td>
                  <td class="cell-truncate">{{ employee.email ?? '—' }}</td>
                  <td>{{ roleLabel(employee.role) }}</td>
                  <td class="cell-truncate">{{ officeLabels(employee) }}</td>
                  <td>
                    <app-ui-badge [tone]="statusTone(employee)">
                      {{ employee.status === 'active' ? 'Активний' : 'Неактивний' }}
                    </app-ui-badge>
                  </td>
                  <td class="cell-activity">{{ formatDateTime(employee.lastActiveAt) }}</td>
                  <td class="cell-actions">
                    <app-ui-button
                      variant="secondary"
                      size="small"
                      (pressed)="openEmployee(employee)"
                    >
                      {{ 'common.profile' | translate }}
                    </app-ui-button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="empty-cell">Немає деактивованих акаунтів.</td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }
    </section>
  `,
  styles: `
    .accounts-page {
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

    h1,
    h2 {
      margin: 0;
      font-family: var(--ui-font-display), sans-serif;
      letter-spacing: 0;
    }

    h1 {
      font-size: 2rem;
    }

    h2 {
      font-size: 1.25rem;
    }

    .page-header p:not(.page-kicker) {
      margin: var(--ui-space-2) 0 0;
      color: var(--ui-text-muted);
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

    .create-panel {
      padding: var(--ui-space-5);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      display: grid;
      gap: var(--ui-space-4);
    }

    .create-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ui-space-4);
    }

    .office-fieldset {
      grid-column: 1 / -1;
      margin: 0;
      padding: var(--ui-space-3) var(--ui-space-4);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      display: flex;
      flex-wrap: wrap;
      gap: var(--ui-space-3);
    }

    .office-fieldset legend {
      padding: 0 var(--ui-space-2);
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .office-check {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
      font-size: 0.875rem;
      cursor: pointer;
    }

    .create-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--ui-space-2);
    }

    .filters {
      display: grid;
      grid-template-columns: minmax(18rem, 1fr) 14rem 14rem;
      gap: var(--ui-space-4);
      align-items: start;
    }

    .accounts-sections {
      display: grid;
      gap: var(--ui-space-5);
    }

    .accounts-table-panel--inactive {
      margin-top: var(--ui-space-2);
    }

    .accounts-table-panel {
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
    }

    .section-header {
      min-height: 3.25rem;
      padding: 0 var(--ui-space-4);
      border-bottom: 1px solid var(--ui-border);
      background: var(--ui-surface-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-space-3);
    }

    .section-header span {
      color: var(--ui-text-muted);
      font-size: 0.8125rem;
      font-weight: 650;
    }

    table.accounts-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 0.875rem;
    }

    .col-employee {
      width: 24%;
    }

    .col-email {
      width: 21%;
    }

    .col-role {
      width: 12%;
    }

    .col-office {
      width: 10%;
    }

    .col-status {
      width: 10%;
    }

    .col-activity {
      width: 15%;
    }

    .col-actions {
      width: 8rem;
    }

    th,
    td {
      min-width: 0;
      padding: var(--ui-space-3) var(--ui-space-4);
      border-bottom: 1px solid var(--ui-border);
      text-align: left;
      vertical-align: middle;
    }

    th {
      background: var(--ui-surface-subtle);
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
      font-weight: 750;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    td strong {
      display: block;
    }

    td app-ui-user {
      max-width: 100%;
    }

    .cell-truncate {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cell-employee small {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
    }

    .cell-activity {
      white-space: nowrap;
    }

    .cell-actions {
      overflow: visible;
      padding-inline: var(--ui-space-3) var(--ui-space-4);
      white-space: nowrap;
    }

    tbody tr:hover {
      background: var(--ui-surface-subtle);
    }

    .empty-cell,
    .loading-cell {
      height: 12rem;
      color: var(--ui-text-muted);
      text-align: center;
    }
  `,
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
  protected readonly createRole = signal<UserRole>('office_member');
  protected readonly selectedOfficeIds = signal<string[]>([]);

  protected readonly formatDateTime = formatDateTime;
  protected roleLabel = (role: string) => this.i18n.roleLabel(role);
  protected readonly officeOptions = computed((): readonly UiSelectOption[] => [
    { value: 'all', label: this.i18n.t('office.all') },
    { value: 'kyiv', label: this.i18n.t('office.kyiv') },
    { value: 'warsaw', label: this.i18n.t('office.warsaw') },
  ]);
  protected readonly roleOptions = computed((): readonly UiSelectOption[] => [
    { value: 'all', label: this.i18n.t('role.all') },
    { value: 'super_admin', label: this.i18n.roleLabel('super_admin') },
    { value: 'curator', label: this.i18n.roleLabel('curator') },
    { value: 'office_admin', label: this.i18n.roleLabel('office_admin') },
    { value: 'office_member', label: this.i18n.roleLabel('office_member') },
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
      this.query().trim() !== '' ||
      this.officeFilter() !== 'all' ||
      this.roleFilter() !== 'all',
  );

  protected readonly superAdmins = computed(() =>
    this.employees().filter((employee) => employee.role === 'super_admin'),
  );

  protected readonly officeAdmins = computed(() =>
    this.employees().filter(
      (employee) => employee.role === 'office_admin' || employee.role === 'curator',
    ),
  );

  protected readonly kyivManagers = computed(() =>
    this.employees().filter(
      (employee) => employee.role === 'office_member' && employee.officeIds.includes('kyiv'),
    ),
  );

  protected readonly warsawManagers = computed(() =>
    this.employees().filter(
      (employee) => employee.role === 'office_member' && employee.officeIds.includes('warsaw'),
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

  protected readonly filteredEmployees = computed(() =>
    this.filterEmployees(this.employees()),
  );

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
    this.createRole.set('office_member');
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
