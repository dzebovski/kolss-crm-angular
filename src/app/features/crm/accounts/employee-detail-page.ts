import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '@core/session/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import {
  ASSIGNABLE_ROLES,
  DEFAULT_ROLE,
  isSuperAdminRole,
  ROLE_CURATOR,
  ROLE_OFFICE_ADMIN,
  ROLE_SUPER_ADMIN,
} from '@core/roles/roles';
import type { MessageKey } from '@core/i18n/messages';
import type { UserRole } from '@models/database';
import { callStatusTone, clientStatusTone, formatDateTime } from '@domain/lead.rules';
import { LeadsService } from '@services/leads.service';
import { UsersService, type CrmEmployee } from '@services/users.service';
import { UiAlert } from '@ui/feedback/ui-alert';
import { UiBadge } from '@ui/feedback/ui-badge';
import { UiButton } from '@ui/button/ui-button';
import { UiDialogService } from '@ui/dialog/ui-dialog';
import { UiIcon } from '@ui/icon/ui-icon';
import { UiUser } from '@ui/user/ui-user';
import { UiSelect, type UiSelectOption } from '@ui/form/ui-select';
import { UiTextField } from '@ui/form/ui-text-field';

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
  templateUrl: './employee-detail-page.html',
  styleUrl: './employee-detail-page.scss',
})
export class EmployeeDetailPage {
  private readonly router = inject(Router);
  private readonly usersService = inject(UsersService);
  private readonly leadsService = inject(LeadsService);
  private readonly session = inject(SessionService);
  private readonly dialog = inject(UiDialogService);
  protected readonly i18n = inject(I18nService);

  readonly employeeId = input.required<string>();
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly actionError = signal('');
  protected readonly notice = signal('');
  protected readonly editEmail = signal('');
  protected readonly editDisplayName = signal('');
  protected readonly editPassword = signal('');
  protected readonly editPasswordConfirm = signal('');
  protected readonly editRole = signal<UserRole>(DEFAULT_ROLE);
  protected readonly selectedOfficeIds = signal<string[]>([]);

  protected readonly employeeResource = resource({
    params: () => ({ employeeId: this.employeeId() }),
    loader: ({ params }) => this.usersService.getEmployee(params.employeeId),
  });
  protected readonly assignedLeadsResource = resource({
    params: () => ({ employeeId: this.employeeId() }),
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

  protected isSuperAdminEmployee(employee: CrmEmployee): boolean {
    return isSuperAdminRole(employee.role);
  }

  protected permissions(employee: CrmEmployee): readonly string[] {
    const keys =
      employee.role === ROLE_SUPER_ADMIN
        ? SUPER_ADMIN_PERMISSIONS
        : employee.role === ROLE_CURATOR
          ? CURATOR_PERMISSIONS
          : employee.role === ROLE_OFFICE_ADMIN
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
      this.dialog
        .confirm({
          title: this.i18n.t('accounts.detail.deactivateTitle'),
          description: this.i18n.t('accounts.detail.deactivateDesc', {
            name: employee.displayName,
          }),
          confirmLabel: this.i18n.t('common.continue'),
          danger: true,
        })
        .afterClosed(),
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
      this.dialog
        .confirm({
          title: this.i18n.t('accounts.detail.reactivateTitle'),
          description: this.i18n.t('accounts.detail.reactivateDesc', {
            name: employee.displayName,
          }),
          confirmLabel: this.i18n.t('accounts.detail.reactivate'),
        })
        .afterClosed(),
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
      this.dialog
        .confirm({
          title: this.i18n.t('accounts.detail.deleteTitle'),
          description: this.i18n.t('accounts.detail.deleteDesc', {
            name: employee.displayName,
          }),
          confirmLabel: this.i18n.t('common.delete'),
          danger: true,
        })
        .afterClosed(),
    );
    if (!confirmed || !employee.email) return;

    const email = window.prompt(this.i18n.t('accounts.detail.confirmEmailDelete'), employee.email);
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
