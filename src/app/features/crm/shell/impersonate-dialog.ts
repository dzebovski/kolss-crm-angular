import { Component, computed, effect, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import type { UserRole } from '../../../models/database';
import { ASSIGNABLE_ROLES, roleLabel } from '../../../core/roles/roles';
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
  imports: [UiAlert, UiButton, UiSelect],
  template: `
    <div class="impersonate-dialog" aria-labelledby="impersonate-title">
      <div class="impersonate-dialog__mark" aria-hidden="true"></div>
      <header class="impersonate-dialog__header">
        <h2 id="impersonate-title">Увійти як…</h2>
        <p>Це перемикає Supabase сесію та RLS-доступи на обраного співробітника.</p>
      </header>

      @if (error()) {
        <app-ui-alert tone="danger" title="Не вдалося виконати імперсонацію">
          {{ error() }}
        </app-ui-alert>
      }

      <div class="impersonate-dialog__grid">
        <app-ui-select label="Роль" [options]="roleOptions()" [(value)]="role" />
        <app-ui-select
          label="Офіс"
          placeholder="Оберіть офіс"
          [disabled]="officeOptions().length === 0"
          [options]="officeOptions()"
          [(value)]="officeId"
        />
        <app-ui-select
          label="Менеджер"
          placeholder="Оберіть співробітника"
          [disabled]="managerOptions().length === 0"
          [options]="managerOptions()"
          [(value)]="userId"
        />
      </div>

      <footer class="impersonate-dialog__actions">
        <app-ui-button variant="ghost" (pressed)="close()">Скасувати</app-ui-button>
        <app-ui-button
          variant="primary"
          [loading]="submitting()"
          [disabled]="!canSubmit()"
          (pressed)="submit()"
        >
          Увійти
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

  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  protected readonly users = signal<readonly AdminUserRow[]>([]);

  protected readonly role = signal<string>(this.data.initialRole ?? 'office_member');
  protected readonly officeId = signal('');
  protected readonly userId = signal('');

  private readonly activeUsers = computed(() => this.users().filter((u) => u.profile.is_active));

  protected readonly roleOptions = computed<readonly UiSelectOption[]>(() =>
    ASSIGNABLE_ROLES.map((value) => ({ value, label: roleLabel(value) })),
  );

  protected readonly officeOptions = computed<readonly UiSelectOption[]>(() => {
    const byId = new Map<string, UiSelectOption>();
    for (const row of this.activeUsers()) {
      for (const office of row.offices ?? []) {
        byId.set(office.id, { value: office.id, label: office.name_uk });
      }
    }
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, 'uk'));
  });

  protected readonly managerOptions = computed<readonly UiSelectOption[]>(() => {
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
    return matches.sort((a, b) => a.label.localeCompare(b.label, 'uk'));
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
      this.error.set(e instanceof Error ? e.message : 'Не вдалося завантажити список співробітників');
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
      this.error.set(e instanceof Error ? e.message : 'Не вдалося виконати імперсонацію');
    } finally {
      this.submitting.set(false);
    }
  }
}

