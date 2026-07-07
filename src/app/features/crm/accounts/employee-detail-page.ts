import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { roleLabel } from '../../../core/roles/roles';
import {
  employeeInitials,
  formatDateTime,
  officeName,
  WORKFLOW_LABELS,
  workflowTone,
} from '../../../services/crm-mock.helpers';
import { CrmMockService } from '../../../services/crm-mock.service';
import type { MockEmployee } from '../../../services/crm-mock.types';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiIcon } from '../../../ui/icon/ui-icon';

@Component({
  selector: 'app-employee-detail-page',
  imports: [RouterLink, UiBadge, UiIcon],
  template: `
    @if (employee(); as employee) {
      <section class="employee-page" [attr.aria-labelledby]="'employee-' + employee.id">
        <a class="back-link" routerLink="/crm/accounts">
          <app-ui-icon name="arrow_back" [size]="17" />
          До акаунтів
        </a>

        <header class="employee-header">
          <div class="avatar" aria-hidden="true">{{ initials(employee.displayName) }}</div>
          <div>
            <p class="page-kicker">{{ roleLabel(employee.role) }}</p>
            <h1 [id]="'employee-' + employee.id">{{ employee.displayName }}</h1>
            <p>{{ employee.email }}</p>
          </div>
          <app-ui-badge [tone]="employee.status === 'active' ? 'success' : 'warning'">
            {{ employee.status === 'active' ? 'Активний' : 'Неактивний' }}
          </app-ui-badge>
        </header>

        <div class="employee-layout">
          <section class="profile-panel" aria-labelledby="profile-title">
            <h2 id="profile-title">Профіль і доступ</h2>
            <dl>
              <div>
                <dt>Офіс</dt>
                <dd>{{ officeLabels(employee) }}</dd>
              </div>
              <div>
                <dt>Мова</dt>
                <dd>{{ employee.locale.toUpperCase() }}</dd>
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
            <p class="empty">У цього співробітника поки немає призначених лідів у мок-даних.</p>
          }
        </section>
      </section>
    } @else {
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

    .avatar {
      width: 4rem;
      height: 4rem;
      border-radius: var(--ui-radius-lg);
      background: var(--ui-brand-gradient);
      color: white;
      display: grid;
      place-items: center;
      font-size: 1.25rem;
      font-weight: 800;
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
      font-family: var(--ui-font-display);
      letter-spacing: 0;
    }

    h1 {
      font-size: 2rem;
    }

    .employee-header p:not(.page-kicker),
    .empty {
      color: var(--ui-text-muted);
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
  private readonly crm = inject(CrmMockService);

  protected readonly employeeId = this.route.snapshot.paramMap.get('employeeId') ?? '';
  protected readonly employee = computed(() => this.crm.employeeById(this.employeeId));
  protected readonly assignedLeads = computed(() =>
    this.crm.leads().filter((lead) => lead.assignedToId === this.employeeId),
  );

  protected readonly roleLabel = roleLabel;
  protected readonly formatDateTime = formatDateTime;
  protected readonly officeName = officeName;
  protected readonly workflowTone = workflowTone;
  protected readonly WORKFLOW_LABELS = WORKFLOW_LABELS;

  protected initials(name: string): string {
    return employeeInitials(name);
  }

  protected officeLabels(employee: MockEmployee): string {
    return employee.officeIds.map((officeId) => officeName(officeId)).join(', ');
  }

  protected permissions(employee: MockEmployee): readonly string[] {
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
}
