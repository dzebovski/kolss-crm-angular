import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { UiIconButton } from '../../../ui/button/ui-icon-button';
import { LeadDetailView } from './lead-detail-page';

export interface LeadDetailDrawerData {
  readonly leadIds: readonly string[];
  readonly initialLeadId: string;
  readonly state: LeadDetailDrawerState;
}

export interface LeadDetailDrawerState {
  dirty: boolean;
}

export interface LeadDetailDrawerResult {
  readonly dirty: boolean;
}

@Component({
  selector: 'app-lead-detail-drawer',
  imports: [LeadDetailView, UiIconButton],
  template: `
    <section class="lead-drawer" aria-labelledby="lead-drawer-title">
      <header class="lead-drawer__toolbar">
        <div>
          <span id="lead-drawer-title">Перевірка лідів</span>
          <strong>{{ currentIndex() + 1 }} / {{ data.leadIds.length }}</strong>
        </div>
        <nav aria-label="Навігація між лідами">
          <app-ui-icon-button
            icon="chevron_left"
            label="Попередній лід"
            size="small"
            [disabled]="currentIndex() === 0"
            (pressed)="previous()"
          />
          <app-ui-icon-button
            icon="chevron_right"
            label="Наступний лід"
            size="small"
            [disabled]="currentIndex() >= data.leadIds.length - 1"
            (pressed)="next()"
          />
          <span class="lead-drawer__divider" aria-hidden="true"></span>
          <app-ui-icon-button icon="close" label="Закрити лід" size="small" (pressed)="close()" />
        </nav>
      </header>

      <div class="lead-drawer__content">
        <app-lead-detail-view [leadId]="leadId()" displayMode="drawer" (changed)="markDirty()" />
      </div>
    </section>
  `,
  styles: `
    :host,
    .lead-drawer {
      display: block;
      height: 100%;
      min-height: 0;
    }

    .lead-drawer {
      background:
        linear-gradient(
          180deg,
          color-mix(in srgb, var(--ui-surface-subtle) 88%, white),
          transparent 18rem
        ),
        var(--ui-surface-canvas);
      overflow: auto;
      overscroll-behavior: contain;
    }

    .lead-drawer__toolbar {
      position: sticky;
      top: 0;
      z-index: 4;
      min-height: 4rem;
      padding: 0.7rem var(--ui-space-5);
      border-bottom: 1px solid var(--ui-border);
      background: color-mix(in srgb, var(--ui-surface-raised) 94%, transparent);
      backdrop-filter: blur(18px) saturate(1.15);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-space-4);
    }

    .lead-drawer__toolbar > div {
      display: grid;
      gap: 0.12rem;
    }

    .lead-drawer__toolbar span {
      color: var(--ui-text-subtle);
      font-size: 0.69rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .lead-drawer__toolbar strong {
      font-family: var(--ui-font-display), sans-serif;
      font-size: 1rem;
    }

    .lead-drawer__toolbar nav {
      display: inline-flex;
      align-items: center;
      gap: 0.38rem;
    }

    .lead-drawer__divider {
      width: 1px;
      height: 1.5rem;
      margin: 0 0.2rem;
      background: var(--ui-border-strong);
    }

    .lead-drawer__content {
      padding: var(--ui-space-5);
    }

    @media (max-width: 40rem) {
      .lead-drawer__toolbar,
      .lead-drawer__content {
        padding-left: var(--ui-space-3);
        padding-right: var(--ui-space-3);
      }
    }
  `,
})
export class LeadDetailDrawer {
  protected readonly data = inject<LeadDetailDrawerData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<LeadDetailDrawer, LeadDetailDrawerResult>);
  protected readonly currentIndex = signal(
    Math.max(0, this.data.leadIds.indexOf(this.data.initialLeadId)),
  );
  protected readonly leadId = computed(() => this.data.leadIds[this.currentIndex()] ?? '');
  private readonly dirty = signal(false);

  protected previous(): void {
    this.currentIndex.update((index) => Math.max(0, index - 1));
  }

  protected next(): void {
    this.currentIndex.update((index) => Math.min(this.data.leadIds.length - 1, index + 1));
  }

  protected markDirty(): void {
    this.dirty.set(true);
    this.data.state.dirty = true;
  }

  protected close(): void {
    this.dialogRef.close({ dirty: this.dirty() });
  }
}
