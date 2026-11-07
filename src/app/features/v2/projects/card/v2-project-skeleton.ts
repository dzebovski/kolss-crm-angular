import { Component, inject } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';

// Loading state of the Project card (Project-card-loading board): a skeleton with the layout of
// the real screen, no spinners in content. Bars use `line-soft`; sizes are board values.
@Component({
  selector: 'app-v2-project-skeleton',
  template: `
    <section class="v2-sk__card v2-sk__card--header">
      <div class="v2-sk__top">
        <div class="v2-sk__col">
          <span class="v2-sk__bar" style="width: 60px; height: 10px"></span>
          <div class="v2-sk__row">
            <span class="v2-sk__bar" style="width: 280px; height: 28px"></span>
            <span class="v2-sk__bar" style="width: 60px; height: 22px"></span>
          </div>
          <span class="v2-sk__bar" style="width: 200px; height: 12px"></span>
        </div>
        <div class="v2-sk__row">
          <span class="v2-sk__bar" style="width: 120px; height: 40px; border-radius: 8px"></span>
          <span class="v2-sk__bar" style="width: 140px; height: 40px; border-radius: 8px"></span>
        </div>
      </div>
      <div class="v2-sk__grid">
        @for (width of contactWidths; track $index) {
          <div class="v2-sk__col v2-sk__col--tight">
            <span class="v2-sk__bar" style="width: 60px; height: 10px"></span>
            <span class="v2-sk__bar" [style.width.%]="width" style="height: 14px"></span>
          </div>
        }
      </div>
    </section>

    <section class="v2-sk__card v2-sk__card--bar">
      <div class="v2-sk__row">
        <span class="v2-sk__bar" style="width: 160px; height: 28px; border-radius: 999px"></span>
        @for (step of steps; track step) {
          <span class="v2-sk__bar" style="width: 90px; height: 12px"></span>
        }
      </div>
    </section>

    <section class="v2-sk__card v2-sk__card--body">
      <span class="v2-sk__bar" style="width: 160px; height: 14px"></span>
      @for (line of shortLines; track line) {
        <div class="v2-sk__row">
          <span class="v2-sk__bar" style="width: 36px; height: 36px; border-radius: 8px"></span>
          <div class="v2-sk__col v2-sk__col--tight v2-sk__grow">
            <span class="v2-sk__bar" [style.width.%]="line" style="height: 12px"></span>
            <span class="v2-sk__bar" style="width: 30%; height: 10px"></span>
          </div>
        </div>
      }
    </section>

    <div class="v2-sk__split">
      @for (title of splitTitles; track title) {
        <section class="v2-sk__card v2-sk__card--body v2-sk__card--tall">
          <span class="v2-sk__bar" [style.width.px]="title" style="height: 14px"></span>
          @for (line of lines; track line) {
            <div class="v2-sk__row">
              <span class="v2-sk__bar" style="width: 36px; height: 36px; border-radius: 8px"></span>
              <div class="v2-sk__col v2-sk__col--tight v2-sk__grow">
                <span class="v2-sk__bar" [style.width.%]="line" style="height: 12px"></span>
                <span class="v2-sk__bar" style="width: 30%; height: 10px"></span>
              </div>
            </div>
          }
        </section>
      }
    </div>

    <section class="v2-sk__card v2-sk__card--body">
      <span class="v2-sk__bar" style="width: 80px; height: 14px"></span>
      @for (line of lines; track line) {
        <div class="v2-sk__row">
          <span class="v2-sk__bar" style="width: 36px; height: 36px; border-radius: 8px"></span>
          <div class="v2-sk__col v2-sk__col--tight v2-sk__grow">
            <span class="v2-sk__bar" [style.width.%]="line" style="height: 12px"></span>
            <span class="v2-sk__bar" style="width: 30%; height: 10px"></span>
          </div>
        </div>
      }
    </section>
  `,
  host: { 'aria-busy': 'true', role: 'status', '[attr.aria-label]': 'label()' },
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--v2-space-4);
    }

    .v2-sk__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 22px var(--v2-space-5);
      background: var(--v2-surface);
      border: 1px solid var(--v2-line);
      border-radius: var(--v2-radius-lg);
    }

    .v2-sk__card--header {
      padding: var(--v2-space-5) var(--v2-space-6);
    }

    .v2-sk__card--bar {
      padding: var(--v2-space-4) var(--v2-space-6);
    }

    .v2-sk__card--tall {
      min-height: 260px;
    }

    .v2-sk__top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--v2-space-5);
    }

    .v2-sk__col {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .v2-sk__col--tight {
      gap: var(--v2-space-2);
    }

    .v2-sk__grow {
      flex-grow: 1;
    }

    .v2-sk__row {
      display: flex;
      align-items: center;
      gap: var(--v2-space-3);
    }

    .v2-sk__grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: var(--v2-space-6);
      padding-top: 18px;
      border-top: 1px solid var(--v2-line-soft);
    }

    .v2-sk__split {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: var(--v2-space-4);
    }

    .v2-sk__bar {
      display: block;
      flex-shrink: 0;
      border-radius: var(--v2-radius-xs);
      background: var(--v2-line-soft);
    }
  `,
})
export class V2ProjectSkeleton {
  private readonly i18n = inject(I18nService);

  protected readonly label = () => this.i18n.t('common.loading');
  protected readonly contactWidths = [70, 93, 86, 79, 72];
  protected readonly steps = [1, 2, 3, 4, 5, 6];
  protected readonly lines = [50, 67, 84];
  protected readonly shortLines = [50, 67];
  protected readonly splitTitles = [180, 100];
}
