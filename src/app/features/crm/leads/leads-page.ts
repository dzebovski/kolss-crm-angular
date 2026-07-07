import { Component } from '@angular/core';

@Component({
  selector: 'app-leads-page',
  template: `
    <section class="crm-page">
      <header class="crm-page__header">
        <h1>Ліди</h1>
        <p>Таблиця лідів зʼявиться у Фазі 2 (мок-дані).</p>
      </header>
    </section>
  `,
  styles: `
    .crm-page__header h1 {
      margin: 0 0 var(--ui-space-2);
      font-family: var(--ui-font-display);
      font-size: 1.75rem;
    }

    .crm-page__header p {
      margin: 0;
      color: var(--ui-ink-muted);
    }
  `,
})
export class LeadsPage {}
