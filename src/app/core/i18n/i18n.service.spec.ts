import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { LocaleCode } from '@domain/i18n.types';
import { SessionService } from '@core/session/session.service';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  it('switches nav label when locale changes', async () => {
    const locale = signal<LocaleCode>('uk');
    TestBed.configureTestingModule({
      providers: [I18nService, { provide: SessionService, useValue: { locale } }],
    });

    const i18n = TestBed.inject(I18nService);
    await i18n.ensureLoaded(locale());
    expect(i18n.t('nav.leads')).toBe('Ліди');

    locale.set('pl');
    await i18n.ensureLoaded(locale());
    expect(i18n.t('nav.leads')).toBe('Leady');
  });

  describe('closeReasonLabel', () => {
    const dbReasons = [
      { code: 'expensive', label_uk: 'Дорого з БД', label_pl: 'Za drogo z BD' },
    ] as const;

    function createI18n(initial: LocaleCode): {
      i18n: I18nService;
      locale: WritableSignal<LocaleCode>;
    } {
      const locale = signal(initial);
      TestBed.configureTestingModule({
        providers: [I18nService, { provide: SessionService, useValue: { locale } }],
      });
      return { i18n: TestBed.inject(I18nService), locale };
    }

    it('prefers message catalog over DB labels when locale is en', async () => {
      const { i18n, locale } = createI18n('en');
      await i18n.ensureLoaded(locale());
      expect(i18n.closeReasonLabel('expensive', dbReasons)).toBe('Too expensive');
    });

    it('returns localized message catalog labels for pl and uk', async () => {
      const { i18n, locale } = createI18n('pl');
      await i18n.ensureLoaded(locale());
      expect(i18n.closeReasonLabel('expensive', dbReasons)).toBe('Za drogo');

      locale.set('uk');
      await i18n.ensureLoaded(locale());
      expect(i18n.closeReasonLabel('expensive', dbReasons)).toBe('Дорого');
    });

    it('falls back to DB tField for unknown codes', async () => {
      const unknownReasons = [
        { code: 'custom_reason', label_uk: 'Кастом UK', label_pl: 'Custom PL' },
      ] as const;

      const { i18n, locale } = createI18n('en');
      await i18n.ensureLoaded(locale());
      expect(i18n.closeReasonLabel('custom_reason', unknownReasons)).toBe('Custom PL');

      locale.set('uk');
      await i18n.ensureLoaded(locale());
      expect(i18n.closeReasonLabel('custom_reason', unknownReasons)).toBe('Кастом UK');
    });
  });
});
