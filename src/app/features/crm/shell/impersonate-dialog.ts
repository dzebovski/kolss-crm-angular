import { Component, computed, effect, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import type { UserRole } from '../../../models/database';
import { ASSIGNABLE_ROLES } from '../../../core/roles/roles';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AdminUsersService, type AdminUserRow } from '../../../services/admin-users.service';
import { ImpersonationService } from '../../../core/impersonation/impersonation.service';
import { SessionService } from '../../../core/session/session.service';
import { UiAlert } from '../../../ui/feedback/ui-alert';
import { UiButton } from '../../../ui/button/ui-button';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';

export interface ImpersonateDialogData {
  readonly initialRole?: UserRole;
}

@Component({
  selector: 'app-impersonate-dialog',
  imports: [UiAlert, UiButton, UiSelect, TranslatePipe],
  template: `
    <div class="impersonate-dialog" aria-labelledby="impersonate-title">
      <div class="impersonate-dialog__mark" aria-hidden="true"></div>
      <header class="impersonate-dialog__header">
        <h2 id="impersonate-title">{{ 'nav.impersonate' | translate }}</h2>
        <p>{{ 'impersonate.description' | translate }}</p>
      </header>

      @if (error()) {
        <app-ui-alert tone="danger" [title]="'impersonate.errorTitle' | translate">
          {{ error() }}
        </app-ui-alert>
      }

      <div class="impersonate-dialog__grid">
        <app-ui-select
          [label]="'common.role' | translate"
          [options]="roleOptions()"
          [(value)]="role"
        />
        <app-ui-select
          [label]="'common.office' | translate"
          [placeholder]="'impersonate.selectOffice' | translate"
          [disabled]="officeOptions().length === 0"
          [options]="officeOptions()"
          [(value)]="officeId"
        />
        <app-ui-select
          [label]="'common.manager' | translate"
          [placeholder]="'impersonate.selectEmployee' | translate"
          [disabled]="managerOptions().length === 0"
          [options]="managerOptions()"
          [(value)]="userId"
        />
      </div>

      <footer class="impersonate-dialog__actions">
        <app-ui-button variant="ghost" (pressed)="close()">
          {{ 'common.cancel' | translate }}
        </app-ui-button>
        <app-ui-button
          variant="primary"
          [loading]="submitting()"
          [disabled]="!canSubmit()"
          (pressed)="submit()"
        >
          {{ 'login.submit' | translate }}
        </app-ui-button>
      </footer>
    </div>
  `,
  styles: `
    .impersonate-dialog {
      width: min(32rem, calc(100vw - 2rem));
      padding: var(--ui-space-6);
      border-radius: var(--ui-radius-lg);
      background: white;
      display: grid;
      gap: var(--ui-space-5);
      overflow-x: hidden;
    }

    .impersonate-dialog__mark {
      width: 3.25rem;
      height: 0.35rem;
      border-radius: var(--ui-radius-pill);
      background: var(--ui-brand-gradient);
    }

    .impersonate-dialog__header h2 {
      margin: var(--ui-space-4) 0 var(--ui-space-2);
      font-family: var(--ui-font-display), sans-serif;
      font-size: 1.5rem;
      letter-spacing: -0.03em;
    }

    .impersonate-dialog__header p {
      margin: 0;
      color: var(--ui-text-muted);
      font-size: 0.875rem;
    }

    .impersonate-dialog__grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--ui-space-4);
    }

    .impersonate-dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--ui-space-2);
    }

    /* Always vertical to avoid horizontal overflow */
  `,
})
export class ImpersonateDialog {
  private readonly data = inject<ImpersonateDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly dialogRef = inject(MatDialogRef<ImpersonateDialog>);
  private readonly adminUsers = inject(AdminUsersService);
  private readonly impersonation = inject(ImpersonationService);
  private readonly session = inject(SessionService);
  private readonly i18n = inject(I18nService);

  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  protected readonly users = signal<readonly AdminUserRow[]>([]);

  protected readonly role = signal<string>(this.data.initialRole ?? 'office_member');
  protected readonly officeId = signal('');
  protected readonly userId = signal('');

  private readonly activeUsers = computed(() => this.users().filter((u) => u.profile.is_active));

  protected readonly roleOptions = computed<readonly UiSelectOption[]>(() => {
    this.i18n.locale();
    return ASSIGNABLE_ROLES.map((value) => ({ value, label: this.i18n.roleLabel(value) }));
  });

  protected readonly officeOptions = computed<readonly UiSelectOption[]>(() => {
    this.i18n.locale();
    const byId = new Map<string, UiSelectOption>();
    for (const row of this.activeUsers()) {
      for (const office of row.offices ?? []) {
        byId.set(office.id, {
          value: office.id,
          label: this.i18n.tField(office as unknown as Record<string, unknown>, 'name', office.id),
        });
      }
    }
    return [...byId.values()].sort((a, b) => this.i18n.compare(a.label, b.label));
  });

  protected readonly managerOptions = computed<readonly UiSelectOption[]>(() => {
    this.i18n.locale();
    const role = this.role();
    const officeId = this.officeId();
    if (!role || !officeId) return [];

    const matches: UiSelectOption[] = [];
    for (const row of this.activeUsers()) {
      if (row.profile.role !== role) continue;
      if (!row.offices.some((o) => o.id === officeId)) continue;
      const name = row.profile.display_name?.trim() || row.email || row.id;
      matches.push({ value: row.id, label: name });
    }
    return matches.sort((a, b) => this.i18n.compare(a.label, b.label));
  });

  protected readonly canSubmit = computed(() => Boolean(this.userId()) && !this.submitting());

  constructor() {
    void this.loadUsers();

    // keep manager selection consistent with filters
    effect(() => {
      this.role();
      this.userId.set('');
    });
    effect(() => {
      this.officeId();
      this.userId.set('');
    });
  }

  private async loadUsers(): Promise<void> {
    this.error.set('');
    try {
      const users = await this.adminUsers.listUsers(true);
      this.users.set(users);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : this.i18n.t('impersonate.loadFailed'));
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected async submit(): Promise<void> {
    const targetId = this.userId();
    if (!targetId) return;
    if (this.submitting()) return;

    this.submitting.set(true);
    this.error.set('');
    try {
      await this.impersonation.startImpersonation(targetId);
      await this.session.loadOfficeContext();
      this.dialogRef.close(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : this.i18n.t('impersonate.submitFailed'));
    } finally {
      this.submitting.set(false);
    }
  }
}
