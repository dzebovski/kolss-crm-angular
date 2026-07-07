import { Component, computed, inject, signal } from '@angular/core';

import { CrmMockService } from '../../../services/crm-mock.service';
import type { FunnelStage } from '../../../services/crm-mock.types';
import { UiBadge } from '../../../ui/feedback/ui-badge';

@Component({
  selector: 'app-reports-page',
  imports: [UiBadge],
  template: `
    <section class="reports-page" aria-labelledby="reports-title">
      <header class="page-header">
        <div>
          <p class="page-kicker">Cohort analytics</p>
          <h1 id="reports-title">Звітність</h1>
          <p>Метрики рахуються по лідах, створених у вибраному періоді.</p>
        </div>

        <div class="period-switcher" aria-label="Період звітності">
          @for (period of periods; track period.days) {
            <button
              type="button"
              [class.is-active]="periodDays() === period.days"
              (click)="periodDays.set(period.days)"
            >
              {{ period.label }}
            </button>
          }
        </div>
      </header>

      <div class="metrics-grid" aria-label="Основні метрики">
        @for (stage of funnel(); track stage.key) {
          <article class="metric-card">
            <span>{{ stage.label }}</span>
            <strong>{{ stage.count }}</strong>
            <app-ui-badge [tone]="stage.tone">{{ stage.percentOfTotal }}% від усіх</app-ui-badge>
          </article>
        }
      </div>

      <section class="funnel-panel" aria-labelledby="funnel-title">
        <header>
          <div>
            <h2 id="funnel-title">Воронка за період</h2>
            <p>{{ totalLeads() }} лідів у когорті, офісний фільтр береться з CRM shell.</p>
          </div>
          <app-ui-badge tone="brand">{{ periodLabel() }}</app-ui-badge>
        </header>

        <ol class="funnel-list">
          @for (stage of funnel(); track stage.key; let index = $index) {
            <li>
              <div class="funnel-row">
                <span class="funnel-index">{{ index + 1 }}</span>
                <div>
                  <strong>{{ stage.label }}</strong>
                  <small> {{ stage.conversionFromPrevious }}% від попереднього етапу </small>
                </div>
                <b>{{ stage.count }}</b>
              </div>
              <div
                class="funnel-track"
                [attr.aria-label]="stage.label + ': ' + stage.percentOfTotal + '%'"
              >
                <span [style.width.%]="barWidth(stage)"></span>
              </div>
            </li>
          }
        </ol>
      </section>
    </section>
  `,
  styles: `
    .reports-page {
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

    h1,
    h2 {
      margin: 0;
      font-family: var(--ui-font-display);
      letter-spacing: 0;
    }

    h1 {
      font-size: 2rem;
    }

    h2 {
      font-size: 1.25rem;
    }

    .page-header p,
    .funnel-panel p {
      margin: var(--ui-space-2) 0 0;
      color: var(--ui-text-muted);
    }

    .period-switcher {
      padding: 0.1875rem;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-subtle);
      display: flex;
      gap: 0.125rem;
    }

    .period-switcher button {
      min-height: 2rem;
      min-width: 5rem;
      padding: 0 var(--ui-space-3);
      border: 0;
      border-radius: calc(var(--ui-radius-md) - 0.1875rem);
      background: transparent;
      color: var(--ui-text-muted);
      cursor: pointer;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .period-switcher button.is-active {
      background: var(--ui-surface-raised);
      color: var(--ui-action);
      box-shadow: var(--ui-shadow-1);
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: var(--ui-space-3);
    }

    .metric-card {
      min-height: 8rem;
      padding: var(--ui-space-4);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      display: grid;
      align-content: space-between;
      gap: var(--ui-space-3);
      box-shadow: var(--ui-shadow-1);
    }

    .metric-card span {
      color: var(--ui-text-muted);
      font-size: 0.8125rem;
      font-weight: 650;
    }

    .metric-card strong {
      font-family: var(--ui-font-display);
      font-size: 2rem;
      line-height: 1;
    }

    .funnel-panel {
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
    }

    .funnel-panel > header {
      min-height: 5rem;
      padding: var(--ui-space-5);
      border-bottom: 1px solid var(--ui-border);
      background: var(--ui-surface-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ui-space-4);
    }

    .funnel-list {
      margin: 0;
      padding: var(--ui-space-5);
      display: grid;
      gap: var(--ui-space-4);
      list-style: none;
    }

    .funnel-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: var(--ui-space-3);
      align-items: center;
    }

    .funnel-index {
      width: 2rem;
      height: 2rem;
      border-radius: var(--ui-radius-md);
      background: color-mix(in srgb, var(--ui-action) 10%, white);
      color: var(--ui-action);
      display: grid;
      place-items: center;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .funnel-row strong,
    .funnel-row small {
      display: block;
    }

    .funnel-row small {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
    }

    .funnel-row b {
      font-family: var(--ui-font-display);
      font-size: 1.35rem;
    }

    .funnel-track {
      height: 0.75rem;
      margin-top: var(--ui-space-2);
      border-radius: var(--ui-radius-pill);
      background: var(--ui-surface-muted);
      overflow: hidden;
    }

    .funnel-track span {
      height: 100%;
      min-width: 0.25rem;
      border-radius: inherit;
      background: var(--ui-brand-gradient);
      display: block;
      transition: width var(--ui-duration) var(--ui-ease);
    }
  `,
})
export class ReportsPage {
  private readonly crm = inject(CrmMockService);

  protected readonly periods = [
    { label: '40 днів', days: 40 },
    { label: 'Тиждень', days: 7 },
    { label: 'Місяць', days: 30 },
    { label: '6 місяців', days: 180 },
  ] as const;
  protected readonly periodDays = signal(40);
  protected readonly funnel = computed(() => this.crm.funnel(this.periodDays()));
  protected readonly totalLeads = computed(() => this.funnel()[0]?.count ?? 0);
  protected readonly periodLabel = computed(
    () => this.periods.find((period) => period.days === this.periodDays())?.label ?? 'Період',
  );

  protected barWidth(stage: FunnelStage): number {
    return Math.max(stage.percentOfTotal, stage.count > 0 ? 6 : 0);
  }
}
