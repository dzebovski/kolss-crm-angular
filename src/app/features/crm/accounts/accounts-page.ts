import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { roleLabel } from '../../../core/roles/roles';
import { formatDateTime, officeName } from '../../../services/crm-mock.helpers';
import { CrmMockService } from '../../../services/crm-mock.service';
import type { MockEmployee, OfficeFilter } from '../../../services/crm-mock.types';
import { UiBadge, UiBadgeTone } from '../../../ui/feedback/ui-badge';
import { UiButton } from '../../../ui/button/ui-button';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiSelect, UiSelectOption } from '../../../ui/form/ui-select';
import { UiTextField } from '../../../ui/form/ui-text-field';

@Component({
  selector: 'app-accounts-page',
  imports: [UiBadge, UiButton, UiIcon, UiSelect, UiTextField],
  template: `
    <section class="accounts-page" aria-labelledby="accounts-title">
      <header class="page-header">
        <div>
          <p class="page-kicker">Access management</p>
          <h1 id="accounts-title">Акаунти</h1>
          <p>9 мок-користувачів: керівні ролі, адміністратор офісу й менеджери Києва/Варшави.</p>
        </div>
        <app-ui-button (pressed)="showCreateState()">
          <app-ui-icon name="add" [size]="17" />
          Створити акаунт
        </app-ui-button>
      </header>

      @if (notice()) {
        <div class="notice" role="status">
          <app-ui-icon name="info" [size]="18" />
          {{ notice() }}
        </div>
      }

      <div class="filters">
        <app-ui-text-field
          label="Пошук"
          type="search"
          placeholder="Імʼя або email"
          [(value)]="query"
        />
        <app-ui-select label="Офіс" [options]="officeOptions" [(value)]="officeFilter" />
        <app-ui-select label="Роль" [options]="roleOptions" [(value)]="roleFilter" />
      </div>

      <section class="accounts-table-panel" aria-label="Список співробітників">
        <table>
          <thead>
            <tr>
              <th>Співробітник</th>
              <th>Роль</th>
              <th>Офіс</th>
              <th>Статус</th>
              <th>Остання активність</th>
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            @for (employee of filteredEmployees(); track employee.id) {
              <tr>
                <td>
                  <strong>{{ employee.displayName }}</strong>
                  <small>{{ employee.email }}</small>
                </td>
                <td>{{ roleLabel(employee.role) }}</td>
                <td>{{ officeLabels(employee) }}</td>
                <td>
                  <app-ui-badge [tone]="statusTone(employee)">
                    {{ employee.status === 'active' ? 'Активний' : 'Неактивний' }}
                  </app-ui-badge>
                </td>
                <td>{{ formatDateTime(employee.lastActiveAt) }}</td>
                <td>
                  <app-ui-button
                    variant="secondary"
                    size="small"
                    (pressed)="openEmployee(employee)"
                  >
                    Профіль
                  </app-ui-button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="empty-cell">Немає співробітників за поточними фільтрами.</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
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

    h1 {
      margin: 0;
      font-family: var(--ui-font-display);
      font-size: 2rem;
      letter-spacing: 0;
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

    .filters {
      display: grid;
      grid-template-columns: minmax(18rem, 1fr) 14rem 14rem;
      gap: var(--ui-space-4);
      align-items: start;
    }

    .accounts-table-panel {
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    th,
    td {
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
    }

    td strong,
    td small {
      display: block;
    }

    td small {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
    }

    tbody tr:hover {
      background: var(--ui-surface-subtle);
    }

    .empty-cell {
      height: 12rem;
      color: var(--ui-text-muted);
      text-align: center;
    }
  `,
})
export class AccountsPage {
  private readonly crm = inject(CrmMockService);
  private readonly router = inject(Router);

  protected readonly query = signal('');
  protected readonly officeFilter = signal<OfficeFilter>('all');
  protected readonly roleFilter = signal('all');
  protected readonly notice = signal('');
  protected readonly formatDateTime = formatDateTime;
  protected readonly roleLabel = roleLabel;
  protected readonly officeOptions: readonly UiSelectOption[] = [
    { value: 'all', label: 'Усі офіси' },
    { value: 'kyiv', label: 'Київ' },
    { value: 'warsaw', label: 'Варшава' },
  ];
  protected readonly roleOptions: readonly UiSelectOption[] = [
    { value: 'all', label: 'Усі ролі' },
    { value: 'super_admin', label: roleLabel('super_admin') },
    { value: 'curator', label: roleLabel('curator') },
    { value: 'office_admin', label: roleLabel('office_admin') },
    { value: 'office_member', label: roleLabel('office_member') },
  ];

  protected readonly filteredEmployees = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('uk-UA');
    const office = this.officeFilter();
    const role = this.roleFilter();
    return this.crm.employees().filter((employee) => {
      const matchesQuery =
        !query ||
        `${employee.displayName} ${employee.email}`.toLocaleLowerCase('uk-UA').includes(query);
      const matchesOffice = office === 'all' || employee.officeIds.includes(office);
      const matchesRole = role === 'all' || employee.role === role;
      return matchesQuery && matchesOffice && matchesRole;
    });
  });

  protected officeLabels(employee: MockEmployee): string {
    return employee.officeIds.map((officeId) => officeName(officeId)).join(', ');
  }

  protected statusTone(employee: MockEmployee): UiBadgeTone {
    return employee.status === 'active' ? 'success' : 'warning';
  }

  protected async openEmployee(employee: MockEmployee): Promise<void> {
    await this.router.navigate(['/crm/accounts', employee.id]);
  }

  protected showCreateState(): void {
    this.notice.set('Створення акаунта у прототипі не викликає Edge Function.');
  }
}
