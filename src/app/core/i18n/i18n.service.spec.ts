import { TestBed } from '@angular/core/testing';

import type { LocaleCode } from '../../services/crm-mock.types';
import { SessionService } from '../session/session.service';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  it('switches nav label when locale changes', () => {
    const locale = { value: 'uk' as LocaleCode };
    TestBed.configureTestingModule({
      providers: [
        I18nService,
        {
          provide: SessionService,
          useValue: {
            locale: () => locale.value,
          },
        },
      ],
    });

    const i18n = TestBed.inject(I18nService);
    expect(i18n.t('nav.leads')).toBe('Ліди');

    locale.value = 'pl';
    expect(i18n.t('nav.leads')).toBe('Leady');
  });

  describe('closeReasonLabel', () => {
    const dbReasons = [
      { code: 'expensive', label_uk: 'Дорого з БД', label_pl: 'Za drogo z BD' },
    ] as const;

    function createI18n(locale: { value: LocaleCode }): I18nService {
      TestBed.configureTestingModule({
        providers: [
          I18nService,
          {
            provide: SessionService,
            useValue: {
              locale: () => locale.value,
            },
          },
        ],
      });
      return TestBed.inject(I18nService);
    }

    it('prefers message catalog over DB labels when locale is en', () => {
      const locale = { value: 'en' as LocaleCode };
      const i18n = createI18n(locale);
      expect(i18n.closeReasonLabel('expensive', dbReasons)).toBe('Too expensive');
    });

    it('returns localized message catalog labels for pl and uk', () => {
      const locale = { value: 'pl' as LocaleCode };
      const i18n = createI18n(locale);
      expect(i18n.closeReasonLabel('expensive', dbReasons)).toBe('Za drogo');

      locale.value = 'uk';
      expect(i18n.closeReasonLabel('expensive', dbReasons)).toBe('Дорого');
    });

    it('falls back to DB tField for unknown codes', () => {
      const locale = { value: 'en' as LocaleCode };
      const i18n = createI18n(locale);
      const unknownReasons = [
        { code: 'custom_reason', label_uk: 'Кастом UK', label_pl: 'Custom PL' },
      ] as const;
      expect(i18n.closeReasonLabel('custom_reason', unknownReasons)).toBe('Custom PL');

      locale.value = 'uk';
      expect(i18n.closeReasonLabel('custom_reason', unknownReasons)).toBe('Кастом UK');
    });
  });
});
