import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { OFFICE_CONFIG } from '@core/office/office.config';
import { ROLE_CURATOR, ROLE_OFFICE_ADMIN, ROLE_OFFICE_MEMBER } from '@core/roles/roles';
import type { OfficeId } from '@domain/office.types';
import type { UserRole } from '@models/database';
import { UsersService } from '@services/users.service';
import { V2DialogShell } from '../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../ui/dialog/v2-form-field';

interface ImpersonationModel {
  office: string;
  role: string;
  managerId: string;
}

interface Option {
  readonly value: string;
  readonly label: string;
}

// "Log in as another user" popup: the v1 impersonation dialog (same fields, filters, copy and
// employee list) in the v2 popup frame (K3). Not drawn in the design (user, 2026-09-24: works
// like v1, v2 style). Closes with the chosen user id; the shell starts the impersonation.
@Component({
  selector: 'app-v2-impersonation-dialog',
  imports: [FormField, TranslatePipe, V2DialogShell, V2FormField],
  template: `
    <app-v2-dialog
      [title]="'impersonation.dialogTitle' | translate"
      [subtitle]="'impersonation.dialogHint' | translate"
      [saveLabel]="'impersonation.confirm' | translate"
      [saveDisabled]="!canConfirm()"
      (save)="confirm()"
    >
      @if (error(); as message) {
        <p class="v2-impersonation__error" role="alert">{{ message }}</p>
      }

      <div class="v2-impersonation__filters">
        <app-v2-form-field [label]="'impersonation.officeFilter' | translate">
          <select [formField]="impersonation.office">
            @for (option of officeOptions(); track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </app-v2-form-field>
        <app-v2-form-field [label]="'impersonation.roleFilter' | translate">
          <select [formField]="impersonation.role">
            @for (option of roleOptions(); track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </app-v2-form-field>
      </div>

      <app-v2-form-field [label]="'impersonation.manager' | translate" [required]="true">
        <select cdkFocusInitial [formField]="impersonation.managerId">
          <option value="" disabled>{{ 'impersonation.managerPlaceholder' | translate }}</option>
          @for (option of managerOptions(); track option.value) {
            <option [value]="option.value">{{ option.label }}</option>
          }
        </select>
      </app-v2-form-field>
    </app-v2-dialog>
  `,
  styles: `
    .v2-impersonation__filters {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--v2-space-3);
    }

    // No error style in the design: danger text on its tint, as a compact inline notice.
    .v2-impersonation__error {
      margin: 0;
      padding: 10px var(--v2-space-3);
      background: var(--v2-danger-bg);
      border-radius: var(--v2-radius-sm);
      color: var(--v2-danger);
      font-size: 13px;
      font-weight: 500;
    }

    @media (max-width: 480px) {
      .v2-impersonation__filters {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class V2ImpersonationDialog {
  private readonly dialogRef = inject<DialogRef<string>>(DialogRef);
  private readonly users = inject(UsersService);
  private readonly i18n = inject(I18nService);

  private readonly managers = resource({ loader: () => this.users.listManagers() });

  private readonly model = signal<ImpersonationModel>({
    office: 'all',
    role: 'all',
    managerId: '',
  });
  protected readonly impersonation = form(this.model, (path) => {
    required(path.managerId);
  });

  protected readonly officeOptions = computed<readonly Option[]>(() => [
    { value: 'all', label: this.i18n.t('office.all') },
    { value: OFFICE_CONFIG.kyiv.id, label: this.i18n.t(OFFICE_CONFIG.kyiv.nameKey) },
    { value: OFFICE_CONFIG.warsaw.id, label: this.i18n.t(OFFICE_CONFIG.warsaw.nameKey) },
  ]);

  protected readonly roleOptions = computed<readonly Option[]>(() => [
    { value: 'all', label: this.i18n.t('role.all') },
    { value: ROLE_OFFICE_ADMIN, label: this.i18n.roleLabel(ROLE_OFFICE_ADMIN) },
    { value: ROLE_OFFICE_MEMBER, label: this.i18n.roleLabel(ROLE_OFFICE_MEMBER) },
    { value: ROLE_CURATOR, label: this.i18n.roleLabel(ROLE_CURATOR) },
  ]);

  private readonly filteredManagers = computed(() => {
    const { office, role } = this.model();
    return (this.managers.hasValue() ? this.managers.value() : []).filter(
      (manager) =>
        (office === 'all' || manager.officeIds.includes(office as OfficeId)) &&
        (role === 'all' || manager.role === (role as UserRole)),
    );
  });

  protected readonly managerOptions = computed<readonly Option[]>(() =>
    this.filteredManagers().map((manager) => ({
      value: manager.id,
      label: `${manager.displayName} (${this.i18n.roleLabel(manager.role)})`,
    })),
  );

  // Same messages as v1: a failed load, or nobody to log in as (none at all, or none left
  // after the filters).
  protected readonly error = computed(() => {
    if (this.managers.status() === 'error') return this.i18n.t('impersonation.loadFailed');
    if (this.managers.hasValue() && this.filteredManagers().length === 0) {
      return this.i18n.t('impersonation.empty');
    }
    return '';
  });

  /** The chosen employee must still match the filters, as the v1 confirm check. */
  protected readonly canConfirm = computed(() => {
    const id = this.model().managerId;
    return (
      this.impersonation().valid() && this.filteredManagers().some((manager) => manager.id === id)
    );
  });

  protected confirm(): void {
    if (!this.canConfirm()) return;
    this.dialogRef.close(this.model().managerId);
  }
}
