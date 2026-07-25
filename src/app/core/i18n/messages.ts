/**
 * Thin barrel kept at the original import path (`@core/i18n/messages`) so
 * existing `import type { MessageKey } from '@core/i18n/messages'` call
 * sites (office.config.ts, dashboard-page.ts, employee-detail-page.ts, …)
 * don't need to change.
 *
 * The actual per-locale translation tables live in `./messages/` and are
 * loaded on demand via `loadMessageBundle()` — see `message-catalog.ts` for
 * why (keeping all three locales out of the initial bundle).
 */
export type { MessageKey, MessageParams, MessageBundle } from './messages/message-catalog';
export { interpolate, loadMessageBundle } from './messages/message-catalog';
