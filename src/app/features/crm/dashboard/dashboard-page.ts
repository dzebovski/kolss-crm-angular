import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CrmMockService } from '../../../services/crm-mock.service';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiButton } from '../../../ui/button/ui-button';
import { UiIcon } from '../../../ui/icon/ui-icon';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, UiBadge, UiButton, UiIcon],
  template: `
    <section class="dashboard-page" aria-labelledby="dashboard-title">
      <header class="page-header">
        <div>
          <p class="page-kicker">Prototype overview</p>
          <h1 id="dashboard-title">Огляд</h1>
          <p>Короткий стан мок-CRM. Основна робоча сторінка прототипу — список лідів.</p>
        </div>
        <app-ui-button routerLink="/crm/leads">
          <app-ui-icon name="view_kanban" [size]="17" />
          Відкрити ліди
        </app-ui-button>
      </header>

      <div class="dashboard-grid">
        <article>
          <span>Ліди</span>
          <strong>{{ crm.leads().length }}</strong>
          <app-ui-badge tone="brand">моки</app-ui-badge>
        </article>
        <article>
          <span>Активні</span>
          <strong>{{ activeLeads() }}</strong>
          <app-ui-badge tone="info">workflow</app-ui-badge>
        </article>
        <article>
          <span>Успішні</span>
          <strong>{{ successfulLeads() }}</strong>
          <app-ui-badge tone="success">contract</app-ui-badge>
        </article>
        <article>
          <span>Співробітники</span>
          <strong>{{ crm.employees().length }}</strong>
          <app-ui-badge tone="neutral">roles</app-ui-badge>
        </article>
      </div>
    </section>
  `,
  styles: `
    .dashboard-page {
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

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--ui-space-4);
    }

    article {
      min-height: 9rem;
      padding: var(--ui-space-5);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      display: grid;
      align-content: space-between;
      box-shadow: var(--ui-shadow-1);
    }

    article span {
      color: var(--ui-text-muted);
      font-size: 0.875rem;
      font-weight: 650;
    }

    article strong {
      font-family: var(--ui-font-display);
      font-size: 2.5rem;
      line-height: 1;
    }
  `,
})
export class DashboardPage {
  protected readonly crm = inject(CrmMockService);
  protected readonly activeLeads = computed(
    () =>
      this.crm
        .leads()
        .filter((lead) => lead.workflowStatus !== 'closed' && lead.workflowStatus !== 'successful')
        .length,
  );
  protected readonly successfulLeads = computed(
    () => this.crm.leads().filter((lead) => lead.workflowStatus === 'successful').length,
  );
}
