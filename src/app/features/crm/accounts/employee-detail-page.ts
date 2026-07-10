import { Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '../../../core/session/session.service';
import { ASSIGNABLE_ROLES, roleLabel } from '../../../core/roles/roles';
import type { UserRole } from '../../../models/database';
import {
  formatDateTime,
  officeName,
  WORKFLOW_LABELS,
  workflowTone,
} from '../../../services/crm-mock.helpers';
import { LeadsService } from '../../../services/leads.service';
import { UsersService, type CrmEmployee } from '../../../services/users.service';
import { UiAlert } from '../../../ui/feedback/ui-alert';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiButton } from '../../../ui/button/ui-button';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiUser } from '../../../ui/user/ui-user';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';
import { UiTextField } from '../../../ui/form/ui-text-field';

@Component({
  selector: 'app-employee-detail-page',
  imports: [
    RouterLink,
    UiAlert,
    UiBadge,
    UiButton,
    UiIcon,
    UiSelect,
    UiTextField,
    UiUser,
  ],
  template: `
    @if (employee(); as employee) {
      <section class="employee-page" [attr.aria-labelledby]="'employee-' + employee.id">
        <a class="back-link" routerLink="/crm/accounts">
          <app-ui-icon name="arrow_back" [size]="17" />
          До акаунтів
        </a>

        @if (actionError()) {
          <app-ui-alert tone="danger" title="Помилка">
            {{ actionError() }}
          </app-ui-alert>
        }

        @if (notice()) {
          <div class="notice" role="status">{{ notice() }}</div>
        }

        <header class="employee-header">
          <app-ui-user
            class="employee-avatar"
            [userId]="employee.id"
            [name]="employee.displayName"
            size="lg"
            [showName]="false"
            [ariaLabel]="employee.displayName"
          />
          <div>
            <p class="page-kicker">{{ roleLabel(employee.role) }}</p>
            <h1 [id]="'employee-' + employee.id">{{ employee.displayName }}</h1>
            <p>{{ employee.email ?? 'Email недоступний' }}</p>
            <small>ID: {{ employee.id }}</small>
          </div>
          <app-ui-badge [tone]="employee.status === 'active' ? 'success' : 'warning'">
            {{ employee.status === 'active' ? 'Активний' : 'Неактивний' }}
          </app-ui-badge>
        </header>

        <div class="actions-bar">
          @if (!editing()) {
            <app-ui-button variant="secondary" (pressed)="startEditing(employee)">
              Редагувати
            </app-ui-button>
            @if (employee.status === 'active' && employee.role !== 'super_admin') {
              <app-ui-button variant="danger" (pressed)="deactivate(employee)">
                Деактивувати
              </app-ui-button>
            }
            @if (employee.status === 'inactive') {
              <app-ui-button variant="secondary" (pressed)="reactivate(employee)">
                Реактивувати
              </app-ui-button>
              @if (employee.role !== 'super_admin') {
                <app-ui-button variant="danger" (pressed)="deletePermanently(employee)">
                  Видалити назавжди
                </app-ui-button>
              }
            }
          } @else {
            <app-ui-button variant="secondary" (pressed)="cancelEditing()">Скасувати</app-ui-button>
            <app-ui-button [disabled]="saving()" (pressed)="saveEdit(employee)">
              {{ saving() ? 'Збереження…' : 'Зберегти' }}
            </app-ui-button>
          }
        </div>

        @if (editing()) {
          <section class="profile-panel edit-panel" aria-labelledby="edit-title">
            <h2 id="edit-title">Редагування профілю</h2>
            <div class="edit-form">
              <app-ui-text-field label="Email" type="email" [(value)]="editEmail" />
              <app-ui-text-field label="Імʼя" [(value)]="editDisplayName" />
              <app-ui-text-field
                label="Новий пароль (опційно)"
                type="password"
                [(value)]="editPassword"
              />
              <app-ui-text-field
                label="Підтвердження пароля"
                type="password"
                [(value)]="editPasswordConfirm"
              />
              <app-ui-select
                label="Роль"
                [options]="assignableRoleOptions"
                [(value)]="editRole"
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
                    {{ office.name_uk }}
                  </label>
                }
              </fieldset>
            </div>
          </section>
        }

        <div class="employee-layout">
          <section class="profile-panel" aria-labelledby="profile-title">
            <h2 id="profile-title">Профіль і доступ</h2>
            <dl>
              <div>
                <dt>Офіс</dt>
                <dd>{{ officeLabels(employee) }}</dd>
              </div>
              <div>
                <dt>Створено</dt>
                <dd>{{ formatDateTime(employee.createdAt) }}</dd>
              </div>
              <div>
                <dt>Остання активність</dt>
                <dd>{{ formatDateTime(employee.lastActiveAt) }}</dd>
              </div>
            </dl>
          </section>

          <section class="profile-panel" aria-labelledby="permissions-title">
            <h2 id="permissions-title">Дозволи</h2>
            <ul class="permissions">
              @for (permission of permissions(employee); track permission) {
                <li>
                  <app-ui-icon name="check_circle" [size]="18" [filled]="true" />
                  {{ permission }}
                </li>
              }
            </ul>
          </section>
        </div>

        <section class="leads-panel" aria-labelledby="employee-leads-title">
          <header>
            <h2 id="employee-leads-title">Повʼязані ліди</h2>
            <span>{{ assignedLeads().length }} записів</span>
          </header>

          @if (assignedLeads().length) {
            <table>
              <thead>
                <tr>
                  <th>Клієнт</th>
                  <th>Статус</th>
                  <th>Офіс</th>
                  <th>Остання активність</th>
                </tr>
              </thead>
              <tbody>
                @for (lead of assignedLeads(); track lead.id) {
                  <tr>
                    <td>
                      <a [routerLink]="['/crm/leads', lead.id]">{{ lead.name }}</a>
                      <small>{{ lead.phone }}</small>
                    </td>
                    <td>
                      <app-ui-badge [tone]="workflowTone(lead.workflowStatus)">
                        {{ WORKFLOW_LABELS[lead.workflowStatus] }}
                      </app-ui-badge>
                    </td>
                    <td>{{ officeName(lead.officeCode) }}</td>
                    <td>{{ formatDateTime(lead.lastActivityAt) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="empty">У цього співробітника поки немає призначених лідів.</p>
          }
        </section>
      </section>
    } @else if (!employeeResource.isLoading()) {
      <section class="missing-state">
        <app-ui-icon name="inbox" [size]="30" />
        <h1>Співробітника не знайдено</h1>
        <a routerLink="/crm/accounts">Повернутись до акаунтів</a>
      </section>
    }
  `,
  styles: `
    .employee-page {
      display: grid;
      gap: var(--ui-space-5);
    }

    .back-link {
      width: fit-content;
      color: var(--ui-text-muted);
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
      font-size: 0.875rem;
      text-decoration: none;
    }

    .back-link:hover,
    table a:hover {
      color: var(--ui-action);
    }

    .notice {
      padding: var(--ui-space-3) var(--ui-space-4);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-raised);
      color: var(--ui-text-muted);
    }

    .employee-header,
    .profile-panel,
    .leads-panel {
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
    }

    .employee-header {
      padding: var(--ui-space-5);
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: var(--ui-space-4);
    }

    .employee-avatar {
      display: inline-flex;
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
    h2,
    p {
      margin: 0;
    }

    h1,
    h2 {
      font-family: var(--ui-font-display), sans-serif;
      letter-spacing: 0;
    }

    h1 {
      font-size: 2rem;
    }

    .employee-header p:not(.page-kicker),
    .employee-header small,
    .empty {
      color: var(--ui-text-muted);
    }

    .actions-bar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ui-space-2);
    }

    .employee-layout {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ui-space-4);
    }

    .profile-panel {
      padding: var(--ui-space-5);
      display: grid;
      gap: var(--ui-space-4);
    }

    .edit-form {
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

    dl,
    .permissions {
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--ui-space-3);
      list-style: none;
    }

    dl div {
      display: grid;
      gap: 0.125rem;
    }

    dt {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    dd {
      margin: 0;
    }

    .permissions li {
      display: flex;
      align-items: center;
      gap: var(--ui-space-2);
      color: var(--ui-text-muted);
    }

    .permissions app-ui-icon {
      color: var(--ui-success);
    }

    .leads-panel {
      overflow: hidden;
    }

    .leads-panel > header {
      min-height: 3.25rem;
      padding: 0 var(--ui-space-5);
      border-bottom: 1px solid var(--ui-border);
      background: var(--ui-surface-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .leads-panel header span {
      color: var(--ui-text-muted);
      font-size: 0.8125rem;
      font-weight: 650;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    th,
    td {
      padding: var(--ui-space-3) var(--ui-space-5);
      border-bottom: 1px solid var(--ui-border);
      text-align: left;
    }

    th {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
      font-weight: 750;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    table a {
      color: var(--ui-text);
      font-weight: 700;
      text-decoration: none;
    }

    table small {
      display: block;
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
    }

    .empty {
      padding: var(--ui-space-6);
      text-align: center;
    }

    .missing-state {
      min-height: 28rem;
      display: grid;
      place-items: center;
      align-content: center;
      gap: var(--ui-space-3);
      color: var(--ui-text-muted);
    }
  `,
})
export class EmployeeDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly usersService = inject(UsersService);
  private readonly leadsService = inject(LeadsService);
  private readonly session = inject(SessionService);
  private readonly dialog = inject(UiDialogService);

  protected readonly employeeId = this.route.snapshot.paramMap.get('employeeId') ?? '';
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly actionError = signal('');
  protected readonly notice = signal('');
  protected readonly editEmail = signal('');
  protected readonly editDisplayName = signal('');
  protected readonly editPassword = signal('');
  protected readonly editPasswordConfirm = signal('');
  protected readonly editRole = signal<UserRole>('office_member');
  protected readonly selectedOfficeIds = signal<string[]>([]);

  protected readonly employeeResource = resource({
    params: () => ({ employeeId: this.employeeId }),
    loader: ({ params }) => this.usersService.getEmployee(params.employeeId),
  });
  protected readonly assignedLeadsResource = resource({
    params: () => ({ employeeId: this.employeeId }),
    loader: ({ params }) => this.leadsService.listAssignedTo(params.employeeId),
  });

  protected readonly employee = computed(() => this.employeeResource.value() ?? null);
  protected readonly assignedLeads = computed(() => this.assignedLeadsResource.value() ?? []);

  protected readonly availableOffices = computed(
    () => this.session.officeContext()?.offices ?? this.session.offices(),
  );
  protected readonly assignableRoleOptions: readonly UiSelectOption[] = ASSIGNABLE_ROLES.map(
    (role) => ({ value: role, label: roleLabel(role) }),
  );

  protected readonly roleLabel = roleLabel;
  protected readonly formatDateTime = formatDateTime;
  protected readonly officeName = officeName;
  protected readonly workflowTone = workflowTone;
  protected readonly WORKFLOW_LABELS = WORKFLOW_LABELS;

  protected officeLabels(employee: CrmEmployee): string {
    return employee.officeIds.map((officeId) => officeName(officeId)).join(', ');
  }

  protected permissions(employee: CrmEmployee): readonly string[] {
    if (employee.role === 'super_admin') {
      return ['Усі офіси', 'Керування акаунтами', 'Перегляд усіх лідів', 'Офісний фільтр'];
    }
    if (employee.role === 'curator') {
      return ['Кілька офісів', 'Офісний фільтр', 'Перегляд операційної картини'];
    }
    if (employee.role === 'office_admin') {
      return ['Ліди свого офісу', 'Команда офісу', 'Базове адміністрування доступу'];
    }
    return ['Ліди свого офісу', 'Взяття ліда в роботу', 'Коментарі та workflow-дії'];
  }

  protected isOfficeSelected(officeId: string): boolean {
    return this.selectedOfficeIds().includes(officeId);
  }

  protected toggleOffice(officeId: string): void {
    this.selectedOfficeIds.update((ids) =>
      ids.includes(officeId) ? ids.filter((id) => id !== officeId) : [...ids, officeId],
    );
  }

  protected startEditing(employee: CrmEmployee): void {
    this.editing.set(true);
    this.editEmail.set(employee.email ?? '');
    this.editDisplayName.set(employee.displayName);
    this.editPassword.set('');
    this.editPasswordConfirm.set('');
    this.editRole.set(employee.role);
    this.selectedOfficeIds.set([...employee.officeUuids]);
    this.actionError.set('');
  }

  protected cancelEditing(): void {
    this.editing.set(false);
    this.actionError.set('');
  }

  protected async saveEdit(employee: CrmEmployee): Promise<void> {
    this.saving.set(true);
    this.actionError.set('');
    try {
      await this.usersService.updateEmployee({
        userId: employee.id,
        email: this.editEmail().trim(),
        displayName: this.editDisplayName().trim(),
        password: this.editPassword() || undefined,
        passwordConfirm: this.editPasswordConfirm() || undefined,
        role: this.editRole(),
        officeIds: this.selectedOfficeIds(),
      });
      this.notice.set('Профіль оновлено.');
      this.editing.set(false);
      this.employeeResource.reload();
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'Не вдалося зберегти');
    } finally {
      this.saving.set(false);
    }
  }

  protected async deactivate(employee: CrmEmployee): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Деактивувати акаунт',
        description: `Підтвердіть деактивацію ${employee.displayName}. Потрібно ввести email у наступному кроці.`,
        confirmLabel: 'Продовжити',
        danger: true,
      }).afterClosed(),
    );
    if (!confirmed || !employee.email) return;

    const email = window.prompt('Введіть email для підтвердження:', employee.email);
    if (!email) return;

    this.actionError.set('');
    try {
      await this.usersService.deactivateEmployee(employee.id, email);
      this.notice.set('Акаунт деактивовано.');
      this.employeeResource.reload();
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'Не вдалося деактивувати');
    }
  }

  protected async reactivate(employee: CrmEmployee): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Реактивувати акаунт',
        description: `Повернути доступ для ${employee.displayName}?`,
        confirmLabel: 'Реактивувати',
      }).afterClosed(),
    );
    if (!confirmed) return;

    this.actionError.set('');
    try {
      await this.usersService.reactivateEmployee(employee.id);
      this.notice.set('Акаунт реактивовано.');
      this.employeeResource.reload();
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'Не вдалося реактивувати');
    }
  }

  protected async deletePermanently(employee: CrmEmployee): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Видалити акаунт назавжди',
        description: `Цю дію не можна скасувати. ${employee.displayName} буде видалений повністю.`,
        confirmLabel: 'Видалити',
        danger: true,
      }).afterClosed(),
    );
    if (!confirmed || !employee.email) return;

    const email = window.prompt('Введіть email для підтвердження видалення:', employee.email);
    if (!email) return;

    this.actionError.set('');
    try {
      await this.usersService.deleteEmployee(employee.id, email);
      await this.router.navigate(['/crm/accounts']);
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'Не вдалося видалити');
    }
  }
}
