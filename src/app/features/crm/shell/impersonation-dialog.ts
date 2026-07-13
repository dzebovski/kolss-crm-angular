import { Component, computed, inject, output, signal } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { UserRole } from '../../../models/database';
import type { OfficeId } from '../../../services/crm-mock.types';
import { UsersService, type CrmEmployee } from '../../../services/users.service';
import { UiButton } from '../../../ui/button/ui-button';
import { UiModal } from '../../../ui/dialog/ui-modal';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';

@Component({
  selector: 'app-impersonation-dialog',
  imports: [UiButton, UiModal, UiSelect, TranslatePipe],
  template: `
    <app-ui-modal labelledBy="impersonation-dialog-title" (dismissed)="dismiss()">
      <h2 id="impersonation-dialog-title">{{ 'impersonation.dialogTitle' | translate }}</h2>
      <p>{{ 'impersonation.dialogHint' | translate }}</p>

      @if (error()) {
        <div class="inline-error" role="alert">{{ error() }}</div>
      }

      <div class="modal-grid">
        <app-ui-select
          [label]="'impersonation.officeFilter' | translate"
          [options]="officeOptions()"
          [(value)]="officeFilter"
        />
        <app-ui-select
          [label]="'impersonation.roleFilter' | translate"
          [options]="roleOptions()"
          [(value)]="roleFilter"
        />
      </div>

      <app-ui-select
        [label]="'impersonation.manager' | translate"
        [placeholder]="'impersonation.managerPlaceholder' | translate"
        [required]="true"
        [error]="managerError()"
        [options]="managerOptions()"
        [(value)]="managerId"
      />

      <div class="modal-actions">
        <app-ui-button variant="ghost" (pressed)="dismiss()">{{ 'common.cancel' | translate }}</app-ui-button>
        <app-ui-button
          [loading]="loading() || submitting()"
          [disabled]="loading() || submitting()"
          (pressed)="confirm()"
        >
          {{ 'impersonation.confirm' | translate }}
        </app-ui-button>
      </div>
    </app-ui-modal>
  `,
  styles: `
    .inline-error {
      padding: var(--ui-space-3) var(--ui-space-4);
      border: 1px solid color-mix(in srgb, var(--ui-danger) 24%, white);
      border-radius: var(--ui-radius-md);
      background: var(--ui-danger-soft);
      color: var(--ui-danger);
      font-size: 0.875rem;
      font-weight: 650;
    }

    .modal-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ui-space-3);
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--ui-space-3);
    }

    @media (max-width: 40rem) {
      .modal-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ImpersonationDialog {
  private readonly users = inject(UsersService);
  private readonly i18n = inject(I18nService);

  readonly selected = output<string>();
  readonly cancelled = output<void>();

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected readonly managerError = signal('');
  protected readonly managers = signal<readonly CrmEmployee[]>([]);
  protected readonly officeFilter = signal<string>('all');
  protected readonly roleFilter = signal<string>('all');
  protected readonly managerId = signal('');

  protected readonly officeOptions = computed<readonly UiSelectOption[]>(() => [
    { value: 'all', label: this.i18n.t('office.all') },
    { value: 'kyiv', label: this.i18n.t('office.kyiv') },
    { value: 'warsaw', label: this.i18n.t('office.warsaw') },
  ]);

  protected readonly roleOptions = computed<readonly UiSelectOption[]>(() => [
    { value: 'all', label: this.i18n.t('role.all') },
    { value: 'office_admin', label: this.i18n.t('role.office_admin') },
    { value: 'office_member', label: this.i18n.t('role.office_member') },
    { value: 'curator', label: this.i18n.t('role.curator') },
  ]);

  protected readonly filteredManagers = computed(() => {
    const office = this.officeFilter();
    const role = this.roleFilter();
    return this.managers().filter((manager) => {
      if (office !== 'all' && !manager.officeIds.includes(office as OfficeId)) {
        return false;
      }
      if (role !== 'all' && manager.role !== (role as UserRole)) {
        return false;
      }
      return true;
    });
  });

  protected readonly managerOptions = computed<readonly UiSelectOption[]>(() =>
    this.filteredManagers().map((manager) => ({
      value: manager.id,
      label: `${manager.displayName} (${this.i18n.roleLabel(manager.role)})`,
    })),
  );

  constructor() {
    void this.loadManagers();
  }

  protected dismiss(): void {
    this.cancelled.emit();
  }

  protected confirm(): void {
    const id = this.managerId().trim();
    if (!id) {
      this.managerError.set(this.i18n.t('impersonation.managerPlaceholder'));
      return;
    }
    if (!this.filteredManagers().some((manager) => manager.id === id)) {
      this.managerError.set(this.i18n.t('impersonation.empty'));
      return;
    }
    this.managerError.set('');
    this.submitting.set(true);
    this.selected.emit(id);
  }

  private async loadManagers(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const items = await this.users.listManagers();
      this.managers.set(items);
      if (items.length === 0) {
        this.error.set(this.i18n.t('impersonation.empty'));
      }
    } catch {
      this.error.set(this.i18n.t('impersonation.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }
}
