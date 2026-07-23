import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { linkifySegments } from '../../core/text/linkify';

@Component({
  selector: 'app-linkified-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="linkified-text">
      @for (part of segments(); track $index) {
        @if (part.type === 'link') {
          <a [href]="part.value" target="_blank" rel="noopener noreferrer">{{ part.value }}</a>
        } @else {
          {{ part.value }}
        }
      }
    </span>
  `,
  styles: `
    :host {
      display: contents;
    }

    .linkified-text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    a {
      color: var(--ui-action);
      text-decoration: underline;
      text-underline-offset: 0.12em;
    }

    a:hover {
      color: var(--ui-action);
      opacity: 0.85;
    }
  `,
})
export class LinkifiedText {
  readonly text = input<string | null | undefined>('');

  protected readonly segments = computed(() => linkifySegments(this.text()));
}
