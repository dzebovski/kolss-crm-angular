import { Component, input, output } from '@angular/core';

import type { LeadMarker, LeadMarkerKind } from '../../../services/crm-mock.types';

const MARKER_COPY: Readonly<Record<LeadMarkerKind, { emoji: string; label: string }>> = {
  reviewed: { emoji: '✓', label: 'Перевірено' },
  manager_aware: { emoji: '👀', label: 'Менеджер у курсі' },
};

@Component({
  selector: 'app-lead-marker-toggles',
  template: `
    <div class="lead-markers" role="group" aria-label="Контрольні позначки ліда">
      @for (kind of kinds; track kind) {
        @let marker = markerFor(kind);
        <button
          type="button"
          class="lead-marker"
          [class.lead-marker--reviewed]="kind === 'reviewed'"
          [class.lead-marker--aware]="kind === 'manager_aware'"
          [class.lead-marker--active]="!!marker"
          [attr.aria-label]="actionLabel(kind, !!marker)"
          [attr.aria-pressed]="!!marker"
          [attr.title]="tooltip(kind, marker)"
          [disabled]="disabled() || pending() === kind"
          (click)="toggled.emit(kind)"
        >
          <span aria-hidden="true">{{ copy(kind).emoji }}</span>
          @if (showLabels()) {
            <small>{{ copy(kind).label }}</small>
          }
          @if (pending() === kind) {
            <i aria-hidden="true"></i>
          }
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .lead-markers {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .lead-marker {
      min-width: 2rem;
      min-height: 2rem;
      padding: 0.25rem 0.55rem;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-pill);
      background: color-mix(in srgb, var(--ui-surface-raised) 94%, transparent);
      color: var(--ui-text-muted);
      font: inherit;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.38rem;
      cursor: pointer;
      transition:
        transform var(--ui-duration-fast) var(--ui-ease),
        border-color var(--ui-duration-fast) var(--ui-ease),
        background var(--ui-duration-fast) var(--ui-ease);
    }

    .lead-marker:hover:not(:disabled) {
      transform: translateY(-1px);
      border-color: var(--ui-border-strong);
    }

    .lead-marker:focus-visible {
      outline: 2px solid var(--ui-action);
      outline-offset: 2px;
    }

    .lead-marker--reviewed.lead-marker--active {
      border-color: color-mix(in srgb, var(--ui-success) 46%, var(--ui-border));
      background: var(--ui-success-soft);
      color: color-mix(in srgb, var(--ui-success) 76%, black);
    }

    .lead-marker--aware.lead-marker--active {
      border-color: color-mix(in srgb, var(--ui-info) 46%, var(--ui-border));
      background: var(--ui-info-soft);
      color: color-mix(in srgb, var(--ui-info) 78%, black);
    }

    .lead-marker small {
      font-size: 0.72rem;
      font-weight: 750;
      white-space: nowrap;
    }

    .lead-marker i {
      width: 0.65rem;
      height: 0.65rem;
      border: 1.5px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: marker-spin 0.7s linear infinite;
    }

    .lead-marker:disabled {
      opacity: 0.62;
      cursor: not-allowed;
    }

    @keyframes marker-spin {
      to {
        transform: rotate(1turn);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .lead-marker {
        transition: none;
      }

      .lead-marker i {
        animation-duration: 1.4s;
      }
    }
  `,
})
export class LeadMarkerToggles {
  readonly markers = input<readonly LeadMarker[]>([]);
  readonly pending = input<LeadMarkerKind | null>(null);
  readonly disabled = input(false);
  readonly showLabels = input(false);
  readonly toggled = output<LeadMarkerKind>();

  protected readonly kinds: readonly LeadMarkerKind[] = ['reviewed', 'manager_aware'];

  protected markerFor(kind: LeadMarkerKind): LeadMarker | null {
    return this.markers().find((marker) => marker.kind === kind) ?? null;
  }

  protected copy(kind: LeadMarkerKind): (typeof MARKER_COPY)[LeadMarkerKind] {
    return MARKER_COPY[kind];
  }

  protected actionLabel(kind: LeadMarkerKind, active: boolean): string {
    return `${active ? 'Зняти позначку' : 'Позначити'} «${MARKER_COPY[kind].label}»`;
  }

  protected tooltip(kind: LeadMarkerKind, marker: LeadMarker | null): string {
    if (!marker) return MARKER_COPY[kind].label;
    const date = new Intl.DateTimeFormat('uk-UA', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(marker.markedAt));
    return `${MARKER_COPY[kind].label}: ${marker.actorName}, ${date}`;
  }
}
