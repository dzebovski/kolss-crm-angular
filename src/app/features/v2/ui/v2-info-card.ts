import { Component, input } from '@angular/core';

// Info card from lead card v1.3 (Current status, Reminders & tasks, Documents) and the design
// system README (Cards): `surface`, 1px `line`, `radius-lg`, no shadow; `card-label` title.
// Content after the title goes into `[v2CardAside]` (right side of the title row); the rest is
// the body. Gap and min-height are the consumer's (they differ per card on the board).
@Component({
  selector: 'app-v2-info-card',
  template: `
    <div class="v2-info-card__head">
      <h2 class="v2-info-card__title">{{ title() }}</h2>
      <ng-content select="[v2CardAside]" />
    </div>
    <ng-content />
  `,
  styles: `
    @use '../../../../styles/v2/type';

    :host {
      display: flex;
      flex-direction: column;
      gap: var(--v2-space-4);
      box-sizing: border-box;
      padding: 22px var(--v2-space-5);
      background: var(--v2-surface);
      border: 1px solid var(--v2-line);
      border-radius: var(--v2-radius-lg);
    }

    .v2-info-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--v2-space-3);
    }

    .v2-info-card__title {
      @include type.text(card-label);

      margin: 0;
      color: var(--v2-muted);
    }
  `,
})
export class V2InfoCard {
  readonly title = input.required<string>();
}
