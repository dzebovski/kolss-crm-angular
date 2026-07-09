import { Component, computed, input, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import { employeeInitials } from '../../services/crm-mock.helpers';
import { getAvatarUrl } from './user-avatar';

export type UiUserSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_PX: Record<UiUserSize, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 56,
};

@Component({
  selector: 'app-ui-user',
  imports: [NgOptimizedImage],
  template: `
    <span class="ui-user" [attr.data-size]="size()">
      @if (avatarUrl(); as url) {
        @if (!avatarFailed()) {
          <img
            class="ui-user__avatar"
            [ngSrc]="url"
            [width]="avatarSize()"
            [height]="avatarSize()"
            [attr.alt]="avatarAlt()"
            [attr.aria-hidden]="showName() ? 'true' : null"
            [attr.fetchpriority]="priority() ? 'high' : null"
            (error)="onAvatarError()"
          />
        } @else {
          <span class="ui-user__fallback" aria-hidden="true">{{ initials() }}</span>
        }
      } @else {
        <span class="ui-user__fallback" aria-hidden="true">{{ initials() }}</span>
      }

      @if (showName()) {
        <span class="ui-user__name">{{ name() }}</span>
      } @else if (ariaLabel()) {
        <span class="sr-only">{{ ariaLabel() }}</span>
      }
    </span>
  `,
  styles: `
    .ui-user {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
      min-width: 0;
      vertical-align: middle;
    }

    .ui-user__avatar,
    .ui-user__fallback {
      width: var(--ui-user-size);
      height: var(--ui-user-size);
      border-radius: 999px;
      flex: 0 0 auto;
    }

    .ui-user__avatar {
      object-fit: cover;
      background: var(--ui-surface-muted);
      border: 1px solid color-mix(in srgb, var(--ui-border) 70%, transparent);
    }

    .ui-user__fallback {
      display: grid;
      place-items: center;
      background: var(--ui-brand-gradient);
      color: white;
      font-weight: 850;
      letter-spacing: 0.02em;
      box-shadow: var(--ui-shadow-1);
    }

    .ui-user__name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      color: inherit;
      font-weight: 650;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }

    .ui-user[data-size='xs'] {
      --ui-user-size: 20px;
      gap: 0.45rem;
    }

    .ui-user[data-size='xs'] .ui-user__fallback {
      font-size: 0.625rem;
    }

    .ui-user[data-size='sm'] {
      --ui-user-size: 24px;
    }

    .ui-user[data-size='sm'] .ui-user__fallback {
      font-size: 0.7rem;
    }

    .ui-user[data-size='md'] {
      --ui-user-size: 32px;
      gap: 0.55rem;
    }

    .ui-user[data-size='md'] .ui-user__fallback {
      font-size: 0.85rem;
    }

    .ui-user[data-size='lg'] {
      --ui-user-size: 56px;
      gap: var(--ui-space-3);
    }

    .ui-user[data-size='lg'] .ui-user__fallback {
      font-size: 1.15rem;
    }
  `,
})
export class UiUser {
  readonly userId = input<string | null>(null);
  readonly name = input<string>('');
  readonly size = input<UiUserSize>('sm');
  readonly showName = input<boolean>(true);
  readonly ariaLabel = input<string>('');
  readonly priority = input<boolean>(false);

  protected readonly avatarFailed = signal(false);

  protected readonly avatarUrl = computed(() => getAvatarUrl(this.userId()));
  protected readonly avatarSize = computed(() => SIZE_PX[this.size()]);
  protected readonly initials = computed(() => employeeInitials(this.name() || '—'));

  protected avatarAlt(): string {
    if (this.showName()) return '';
    return this.ariaLabel() || this.name() || 'Користувач';
  }

  protected onAvatarError(): void {
    this.avatarFailed.set(true);
  }
}

