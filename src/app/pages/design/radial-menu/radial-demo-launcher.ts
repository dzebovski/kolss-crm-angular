import { Component, input, output } from '@angular/core';

import { UiIcon } from '../../../ui/icon/ui-icon';
import { RadialDemoVariant } from './radial-menu.types';

@Component({
  selector: 'app-radial-demo-launcher',
  imports: [UiIcon],
  template: `
    <article class="radial-demo-card">
      <div class="radial-demo-card__heading">
        <span>{{ variant().eyebrow }}</span>
        <strong aria-hidden="true">{{ variant().actions.length }}</strong>
      </div>

      <div>
        <h3>{{ variant().title }}</h3>
        <p>{{ variant().description }}</p>
      </div>

      <div class="radial-demo-card__result" aria-live="polite">
        <span>Останній вибір</span>
        <strong [attr.data-testid]="'radial-demo-result-' + variant().id">
          {{ selectedLabel() || 'Ще не обрано' }}
        </strong>
      </div>

      <button
        type="button"
        class="radial-demo-card__launcher"
        [attr.data-testid]="'open-radial-demo-' + variant().id"
        (click)="launchRequested.emit(variant())"
      >
        <span aria-hidden="true">
          <app-ui-icon name="automation" [size]="22" [filled]="true" />
        </span>
        <span>Відкрити {{ variant().actions.length }} дій</span>
        <i aria-hidden="true">↗</i>
      </button>
    </article>
  `,
  styleUrl: './radial-demo-launcher.scss',
})
export class RadialDemoLauncher {
  readonly variant = input.required<RadialDemoVariant>();
  readonly selectedLabel = input('');
  readonly launchRequested = output<RadialDemoVariant>();
}
