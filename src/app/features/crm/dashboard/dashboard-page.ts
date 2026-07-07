import { Component, inject } from '@angular/core';

import { SessionService } from '../../../core/session/session.service';

@Component({
  selector: 'app-dashboard-page',
  template: `
    <section class="crm-page">
      <header class="crm-page__header">
        <h1>Огляд</h1>
        <p>Робочий стіл CRM. Дані підключаться у наступних фазах.</p>
      </header>

      <div class="crm-page__grid">
        <article class="crm-card">
          <h2>Офіси</h2>
          <p>{{ officeCount() }} активних офісів у контексті користувача.</p>
        </article>
        <article class="crm-card">
          <h2>Наступний крок</h2>
          <p>Фаза 2: прототип таблиці лідів на мок-даних.</p>
        </article>
      </div>
    </section>
  `,
  styles: `
    .crm-page {
      display: grid;
      gap: var(--ui-space-6);
    }

    .crm-page__header h1 {
      margin: 0 0 var(--ui-space-2);
      font-family: var(--ui-font-display);
      font-size: 1.75rem;
    }

    .crm-page__header p {
      margin: 0;
      color: var(--ui-ink-muted);
    }

    .crm-page__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ui-space-4);
    }

    .crm-card {
      padding: var(--ui-space-5);
      border: 1px solid var(--ui-border-subtle);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
    }

    .crm-card h2 {
      margin: 0 0 var(--ui-space-2);
      font-size: 1rem;
    }

    .crm-card p {
      margin: 0;
      color: var(--ui-ink-muted);
    }
  `,
})
export class DashboardPage {
  private readonly session = inject(SessionService);
  readonly officeCount = () => this.session.officeContext()?.filterOffices.length ?? 0;
}
