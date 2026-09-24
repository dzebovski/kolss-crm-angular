import { InjectionToken } from '@angular/core';

/** Current time for v2 date rules (relative ages, period ranges); replaceable in tests. */
export const V2_NOW = new InjectionToken<() => Date>('V2_NOW', {
  factory: () => () => new Date(),
});
