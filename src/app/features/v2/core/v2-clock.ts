import { DestroyRef, InjectionToken, inject, signal, type Signal } from '@angular/core';

/** Current time for v2 date rules (relative ages, period ranges); replaceable in tests. */
export const V2_NOW = new InjectionToken<() => Date>('V2_NOW', {
  factory: () => () => new Date(),
});

/**
 * The current time as a signal that refreshes while a popup stays open, so "must be in the
 * future" rules never judge against the moment the lead was loaded. Call in an injection context.
 */
export function v2LiveNow(intervalMs = 10_000): Signal<Date> {
  const clock = inject(V2_NOW);
  const now = signal(clock());
  const timer = setInterval(() => now.set(clock()), intervalMs);
  inject(DestroyRef).onDestroy(() => clearInterval(timer));
  return now.asReadonly();
}
