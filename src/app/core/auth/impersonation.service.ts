import { computed, Injectable, signal } from '@angular/core';

import {
  clearImpersonatedUserId,
  readImpersonatedUserId,
  writeImpersonatedUserId,
} from './impersonation.storage';

@Injectable({ providedIn: 'root' })
export class ImpersonationService {
  private readonly targetUserIdSignal = signal<string | null>(readImpersonatedUserId());

  readonly targetUserId = this.targetUserIdSignal.asReadonly();
  readonly isActive = computed(() => Boolean(this.targetUserIdSignal()));

  start(userId: string): void {
    const trimmed = userId.trim();
    if (!trimmed) {
      this.clear();
      return;
    }
    writeImpersonatedUserId(trimmed);
    this.targetUserIdSignal.set(trimmed);
  }

  stop(): void {
    this.clear();
  }

  clear(): void {
    clearImpersonatedUserId();
    this.targetUserIdSignal.set(null);
  }
}
