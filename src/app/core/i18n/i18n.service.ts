import { effect, inject, Injectable, PendingTasks, signal, untracked } from '@angular/core';

import type { LocaleCode } from '@domain/i18n.types';
import { SessionService } from '@core/session/session.service';
import {
  compareForLocale,
  formatDateForLocale,
  formatShortDateForLocale,
  formatDateTimeForLocale,
  formatMoneyForLocale,
  formatMonthYearForLocale,
} from './locale-format';
import {
  interpolate,
  loadMessageBundle,
  type MessageBundle,
  type MessageKey,
  type MessageParams,
} from './messages';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly session = inject(SessionService);
  private readonly pendingTasks = inject(PendingTasks);

  /** The active locale's fully-loaded message table, or `null` before the first bundle resolves. */
  private readonly bundleSignal = signal<MessageBundle | null>(null);
  private readonly loadedLocaleSignal = signal<LocaleCode | null>(null);
  private pendingLocale: LocaleCode | null = null;
  private pendingPromise: Promise<void> | null = null;

  constructor() {
    // Reacts to every future change of session.locale() (explicit setLocale()
    // calls, and the /v1/me-derived default computed after login). The very
    // first load is additionally awaited explicitly by the app initializer
    // (see app.config.ts) so nothing renders before it resolves; ensureLoaded
    // dedupes so both call paths collapse into a single fetch.
    effect(() => {
      const locale = this.session.locale();
      untracked(() => void this.ensureLoaded(locale));
    });
  }

  /**
   * Loads `locale`'s message bundle unless it is already loaded or in
   * flight. Registered with `PendingTasks` so `ComponentFixture.whenStable()`
   * (this project's standard async-assertion pattern, see best-practices.md)
   * waits for it too, not just the explicit app-initializer await.
   */
  ensureLoaded(locale: LocaleCode): Promise<void> {
    if (this.loadedLocaleSignal() === locale) return Promise.resolve();
    if (this.pendingLocale === locale && this.pendingPromise) return this.pendingPromise;

    this.pendingLocale = locale;
    const promise = loadMessageBundle(locale).then((bundle) => {
      this.bundleSignal.set(bundle);
      this.loadedLocaleSignal.set(locale);
      if (this.pendingLocale === locale) {
        this.pendingLocale = null;
        this.pendingPromise = null;
      }
    });
    this.pendingPromise = promise;
    this.pendingTasks.run(() => promise);
    return promise;
  }

  /** The currently loaded bundle, for consumers that need direct lookups (e.g. event-presenter). */
  activeBundle(): MessageBundle | null {
    return this.bundleSignal();
  }

  locale(): LocaleCode {
    return this.session.locale();
  }

  /**
   * Synchronous by design — called directly from templates. Returns '' when
   * the active locale's bundle has not resolved yet or `key` is unknown,
   * rather than throwing or showing a raw message key to the user. In
   * practice the app initializer awaits the initial locale before the app
   * renders, so this only matters for the brief window during a runtime
   * locale switch (old text stays on screen until the new bundle resolves).
   */
  t(key: MessageKey, params?: MessageParams): string {
    const template = this.bundleSignal()?.[key];
    return template === undefined ? '' : interpolate(template, params);
  }

  private hasKey(key: string): key is MessageKey {
    const bundle = this.bundleSignal();
    return bundle !== null && key in bundle;
  }

  tField(row: Record<string, unknown> | null | undefined, base: string, fallback = ''): string {
    if (!row) return fallback;
    const locale = this.locale();
    const enKey = `${base}_en`;
    const plKey = `${base}_pl`;
    const ukKey = `${base}_uk`;
    const candidates =
      locale === 'en'
        ? [enKey, plKey, ukKey]
        : locale === 'pl'
          ? [plKey, ukKey, enKey]
          : [ukKey, plKey, enKey];
    for (const key of candidates) {
      const value = row[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return fallback;
  }

  fieldLabel(fieldKey: string): string {
    const key = `field.${fieldKey}`;
    return this.hasKey(key) ? this.t(key) : fieldKey;
  }

  formatDate(value: string | null | undefined): string {
    return formatDateForLocale(value, this.locale());
  }

  formatShortDate(value: string | null | undefined): string {
    return formatShortDateForLocale(value, this.locale());
  }

  formatDateTime(value: string | null | undefined): string {
    return formatDateTimeForLocale(value, this.locale());
  }

  formatMoney(value: number | null | undefined, currency = 'EUR'): string {
    return formatMoneyForLocale(value, this.locale(), currency);
  }

  formatMonthYear(year: number, month: number): string {
    return formatMonthYearForLocale(year, month, this.locale());
  }

  compare(left: string, right: string): number {
    return compareForLocale(left, right, this.locale());
  }

  workflowLabel(status: string): string {
    return this.t(`workflow.${status}` as MessageKey);
  }

  callStatusLabel(status: string): string {
    return this.t(`callStatus.${status}` as MessageKey);
  }

  clientStatusLabel(status: string): string {
    return this.t(`clientStatus.${status}` as MessageKey);
  }

  sourceLabel(source: string): string {
    return this.t(`source.${source}` as MessageKey);
  }

  closeReasonLabel(
    code: string,
    reasons?: readonly {
      readonly code: string;
      readonly label_uk: string;
      readonly label_pl: string;
    }[],
  ): string {
    const key = `closeReason.${code}`;
    if (this.hasKey(key)) return this.t(key);
    const fromDb = reasons?.find((item) => item.code === code);
    if (fromDb) {
      return this.tField(fromDb as unknown as Record<string, unknown>, 'label', code);
    }
    return code;
  }

  roleLabel(role: string): string {
    const key = `role.${role}`;
    if (this.hasKey(key)) return this.t(key);
    return role;
  }

  officeFilterLabel(filter: string): string {
    if (filter === 'all') return this.t('office.all');
    const key = `office.${filter}`;
    if (this.hasKey(key)) return this.t(key);
    return filter;
  }

  firstCallResultLabel(code: string): string {
    const key = `firstCall.${code}`;
    if (this.hasKey(key)) return this.t(key);
    return code;
  }

  eventTitle(eventType: string): string {
    const key = `event.${eventType}`;
    if (this.hasKey(key)) return this.t(key);
    return eventType;
  }

  localizeError(message: string): string {
    if (message.startsWith('error.lossReasonMissing:')) {
      const reason = message.slice('error.lossReasonMissing:'.length);
      return this.t('error.lossReasonMissing', { reason });
    }
    if (this.hasKey(message)) return this.t(message);
    return message;
  }
}
