import { Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '../../../core/session/session.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ASSIGNABLE_ROLES } from '../../../core/roles/roles';
import type { MessageKey } from '../../../core/i18n/messages';
import type { UserRole } from '../../../models/database';
import {
  callStatusTone,
  clientStatusTone,
  formatDateTime,
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

const SUPER_ADMIN_PERMISSIONS = [
  'accounts.permission.allOffices',
  'accounts.permission.manageAccounts',
  'accounts.permission.viewAllLeads',
  'accounts.permission.officeFilter',
] as const satisfies readonly MessageKey[];

const CURATOR_PERMISSIONS = [
  'accounts.permission.multiOffice',
  'accounts.permission.officeFilter',
  'accounts.permission.opsOverview',
  'accounts.permission.editLeadData',
] as const satisfies readonly MessageKey[];

const OFFICE_ADMIN_PERMISSIONS = [
  'accounts.permission.officeLeads',
  'accounts.permission.editLeadData',
  'accounts.permission.officeTeam',
  'accounts.permission.basicAccessAdmin',
] as const satisfies readonly MessageKey[];

const OFFICE_MEMBER_PERMISSIONS = [
  'accounts.permission.officeLeads',
  'accounts.permission.editLeadData',
  'accounts.permission.updateStatuses',
  'accounts.permission.commentsCalls',
] as const satisfies readonly MessageKey[];

@Component({
  selector: 'app-employee-detail-page',
  imports: [
    RouterLink,
    TranslatePipe,
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
          {{ 'accounts.detail.back' | translate }}
        </a>

        @if (actionError()) {
          <app-ui-alert tone="danger" [title]="'common.error' | translate">
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
            <p>{{ employee.email ?? ('accounts.detail.emailUnavailable' | translate) }}</p>
            <small>ID: {{ employee.id }}</small>
          </div>
          <app-ui-badge [tone]="employee.status === 'active' ? 'success' : 'warning'">
            {{
              employee.status === 'active'
                ? ('common.active' | translate)
                : ('common.inactive' | translate)
            }}
          </app-ui-badge>
        </header>

        <div class="actions-bar">
          @if (!editing()) {
            <app-ui-button variant="secondary" (pressed)="startEditing(employee)">
              {{ 'common.edit' | translate }}
            </app-ui-button>
            @if (employee.status === 'active' && employee.role !== 'super_admin') {
              <app-ui-button variant="danger" (pressed)="deactivate(employee)">
                {{ 'accounts.detail.deactivate' | translate }}
              </app-ui-button>
            }
            @if (employee.status === 'inactive') {
              <app-ui-button variant="secondary" (pressed)="reactivate(employee)">
                {{ 'accounts.detail.reactivate' | translate }}
              </app-ui-button>
              @if (employee.role !== 'super_admin') {
                <app-ui-button variant="danger" (pressed)="deletePermanently(employee)">
                  {{ 'accounts.detail.deleteForever' | translate }}
                </app-ui-button>
              }
            }
          } @else {
            <app-ui-button variant="secondary" (pressed)="cancelEditing()">
              {{ 'common.cancel' | translate }}
            </app-ui-button>
            <app-ui-button [disabled]="saving()" (pressed)="saveEdit(employee)">
              {{ saving() ? ('common.saving' | translate) : ('common.save' | translate) }}
            </app-ui-button>
          }
        </div>

        @if (editing()) {
          <section class="profile-panel edit-panel" aria-labelledby="edit-title">
            <h2 id="edit-title">{{ 'accounts.detail.editTitle' | translate }}</h2>
            <div class="edit-form">
              <app-ui-text-field
                [label]="'common.email' | translate"
                type="email"
                [(value)]="editEmail"
              />
              <app-ui-text-field [label]="'common.name' | translate" [(value)]="editDisplayName" />
              <app-ui-text-field
                [label]="'accounts.detail.newPasswordOptional' | translate"
                type="password"
                [(value)]="editPassword"
              />
              <app-ui-text-field
                [label]="'accounts.detail.passwordConfirm' | translate"
                type="password"
                [(value)]="editPasswordConfirm"
              />
              <app-ui-select
                [label]="'common.role' | translate"
                [options]="assignableRoleOptions()"
                [(value)]="editRole"
              />
              <fieldset class="office-fieldset">
                <legend>{{ 'common.offices' | translate }}</legend>
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
          </section>
        }

        <div class="employee-layout">
          <section class="profile-panel" aria-labelledby="profile-title">
            <h2 id="profile-title">{{ 'accounts.detail.profileAccess' | translate }}</h2>
            <dl>
              <div>
                <dt>{{ 'common.office' | translate }}</dt>
                <dd>{{ officeLabels(employee) }}</dd>
              </div>
              <div>
                <dt>{{ 'accounts.detail.created' | translate }}</dt>
                <dd>{{ formatDateTime(employee.createdAt) }}</dd>
              </div>
              <div>
                <dt>{{ 'accounts.lastActivity' | translate }}</dt>
                <dd>{{ formatDateTime(employee.lastActiveAt) }}</dd>
              </div>
            </dl>
          </section>

          <section class="profile-panel" aria-labelledby="permissions-title">
            <h2 id="permissions-title">{{ 'accounts.detail.permissions' | translate }}</h2>
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
            <h2 id="employee-leads-title">{{ 'accounts.detail.relatedLeads' | translate }}</h2>
            <span>{{
              'accounts.detail.recordsCount' | translate: { count: assignedLeads().length }
            }}</span>
          </header>

          @if (assignedLeads().length) {
            <table>
              <thead>
                <tr>
                  <th>{{ 'calendar.client' | translate }}</th>
                  <th>{{ 'common.status' | translate }}</th>
                  <th>{{ 'common.office' | translate }}</th>
                  <th>{{ 'accounts.lastActivity' | translate }}</th>
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
                      <app-ui-badge [tone]="clientStatusTone(lead.clientStatus)">
                        {{ i18n.clientStatusLabel(lead.clientStatus) }}
                      </app-ui-badge>
                      @if (lead.callStatus; as callStatus) {
                        <small class="lead-call-status">
                          <app-ui-badge [tone]="callStatusTone(callStatus)">
                            {{ i18n.callStatusLabel(callStatus) }}
                          </app-ui-badge>
                        </small>
                      }
                    </td>
                    <td>{{ officeLabel(lead.officeCode) }}</td>
                    <td>{{ formatDateTime(lead.lastActivityAt) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="empty">{{ 'accounts.detail.noAssignedLeads' | translate }}</p>
          }
        </section>
      </section>
    } @else if (!employeeResource.isLoading()) {
      <section class="missing-state">
        <app-ui-icon name="inbox" [size]="30" />
        <h1>{{ 'accounts.detail.notFound' | translate }}</h1>
        <a routerLink="/crm/accounts">{{ 'accounts.detail.returnToAccounts' | translate }}</a>
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
  protected readonly i18n = inject(I18nService);

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
  protected readonly assignableRoleOptions = computed((): readonly UiSelectOption[] =>
    ASSIGNABLE_ROLES.map((role) => ({ value: role, label: this.i18n.roleLabel(role) })),
  );

  protected readonly roleLabel = (role: string) => this.i18n.roleLabel(role);
  protected readonly formatDateTime = formatDateTime;
  protected readonly callStatusTone = callStatusTone;
  protected readonly clientStatusTone = clientStatusTone;

  protected officeLabel(code: string): string {
    return this.i18n.officeFilterLabel(code);
  }

  protected officeLabels(employee: CrmEmployee): string {
    return employee.officeIds.map((officeId) => this.officeLabel(officeId)).join(', ');
  }

  protected permissions(employee: CrmEmployee): readonly string[] {
    const keys =
      employee.role === 'super_admin'
        ? SUPER_ADMIN_PERMISSIONS
        : employee.role === 'curator'
          ? CURATOR_PERMISSIONS
          : employee.role === 'office_admin'
            ? OFFICE_ADMIN_PERMISSIONS
            : OFFICE_MEMBER_PERMISSIONS;
    return keys.map((key) => this.i18n.t(key));
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
      this.notice.set(this.i18n.t('accounts.detail.updated'));
      this.editing.set(false);
      this.employeeResource.reload();
    } catch (error) {
      this.actionError.set(
        error instanceof Error ? error.message : this.i18n.t('accounts.detail.saveFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async deactivate(employee: CrmEmployee): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: this.i18n.t('accounts.detail.deactivateTitle'),
        description: this.i18n.t('accounts.detail.deactivateDesc', {
          name: employee.displayName,
        }),
        confirmLabel: this.i18n.t('common.continue'),
        danger: true,
      }).afterClosed(),
    );
    if (!confirmed || !employee.email) return;

    const email = window.prompt(this.i18n.t('accounts.detail.confirmEmail'), employee.email);
    if (!email) return;

    this.actionError.set('');
    try {
      await this.usersService.deactivateEmployee(employee.id, email);
      this.notice.set(this.i18n.t('accounts.detail.deactivated'));
      this.employeeResource.reload();
    } catch (error) {
      this.actionError.set(
        error instanceof Error ? error.message : this.i18n.t('accounts.detail.deactivateFailed'),
      );
    }
  }

  protected async reactivate(employee: CrmEmployee): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: this.i18n.t('accounts.detail.reactivateTitle'),
        description: this.i18n.t('accounts.detail.reactivateDesc', {
          name: employee.displayName,
        }),
        confirmLabel: this.i18n.t('accounts.detail.reactivate'),
      }).afterClosed(),
    );
    if (!confirmed) return;

    this.actionError.set('');
    try {
      await this.usersService.reactivateEmployee(employee.id);
      this.notice.set(this.i18n.t('accounts.detail.reactivated'));
      this.employeeResource.reload();
    } catch (error) {
      this.actionError.set(
        error instanceof Error ? error.message : this.i18n.t('accounts.detail.reactivateFailed'),
      );
    }
  }

  protected async deletePermanently(employee: CrmEmployee): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: this.i18n.t('accounts.detail.deleteTitle'),
        description: this.i18n.t('accounts.detail.deleteDesc', {
          name: employee.displayName,
        }),
        confirmLabel: this.i18n.t('common.delete'),
        danger: true,
      }).afterClosed(),
    );
    if (!confirmed || !employee.email) return;

    const email = window.prompt(
      this.i18n.t('accounts.detail.confirmEmailDelete'),
      employee.email,
    );
    if (!email) return;

    this.actionError.set('');
    try {
      await this.usersService.deleteEmployee(employee.id, email);
      await this.router.navigate(['/crm/accounts']);
    } catch (error) {
      this.actionError.set(
        error instanceof Error ? error.message : this.i18n.t('accounts.detail.deleteFailed'),
      );
    }
  }
}
