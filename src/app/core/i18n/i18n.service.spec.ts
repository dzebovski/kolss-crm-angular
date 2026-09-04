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

  it('translates lead action labels and the comment-or-task explanation', async () => {
    const locale = signal<LocaleCode>('en');
    TestBed.configureTestingModule({
      providers: [I18nService, { provide: SessionService, useValue: { locale } }],
    });
    const i18n = TestBed.inject(I18nService);

    const expected = {
      en: {
        comment: 'Add comment or task',
        call: 'Call result',
        status: 'Set client status',
        description:
          'A comment or task does not change the current statuses. A task will appear in Calendar with its assigned manager, date, and time.',
      },
      uk: {
        comment: 'Додати коментар або завдання',
        call: 'Результат дзвінка',
        status: 'Встановити статус клієнта',
        description:
          'Коментар або завдання не змінює поточні статуси. Завдання з’явиться в Календарі з призначеним менеджером, датою та часом.',
      },
      pl: {
        comment: 'Dodaj komentarz lub zadanie',
        call: 'Wynik połączenia',
        status: 'Ustaw status klienta',
        description:
          'Komentarz lub zadanie nie zmienia bieżących statusów. Zadanie pojawi się w Kalendarzu wraz z przypisanym menedżerem, datą i godziną.',
      },
    } as const;

    for (const code of ['en', 'uk', 'pl'] as const) {
      locale.set(code);
      await i18n.ensureLoaded(code);
      expect(i18n.t('leadDetail.addComment')).toBe(expected[code].comment);
      expect(i18n.t('leadDetail.call')).toBe(expected[code].call);
      expect(i18n.t('leadDetail.clientStatus')).toBe(expected[code].status);
      expect(i18n.t('leadDetail.commentDescription')).toBe(expected[code].description);
    }
  });

  it('translates the estimated project budget label in every locale', async () => {
    const locale = signal<LocaleCode>('en');
    TestBed.configureTestingModule({
      providers: [I18nService, { provide: SessionService, useValue: { locale } }],
    });
    const i18n = TestBed.inject(I18nService);
    const labels = {
      en: 'Estimated project budget',
      uk: 'Орієнтовний бюджет проєкту',
      pl: 'Szacowany budżet projektu',
    } as const;

    for (const code of ['en', 'uk', 'pl'] as const) {
      locale.set(code);
      await i18n.ensureLoaded(code);
      expect(i18n.t('common.estimatedProjectBudget')).toBe(labels[code]);
    }
  });

  it('names the client code in every search hint', async () => {
    const locale = signal<LocaleCode>('en');
    TestBed.configureTestingModule({
      providers: [I18nService, { provide: SessionService, useValue: { locale } }],
    });
    const i18n = TestBed.inject(I18nService);
    const hints = {
      en: {
        calendar: 'Code, name or phone',
        leads: 'Code, phone, name or date',
        empty: 'Try a different code, phone, date, or client name.',
      },
      uk: {
        calendar: 'Код, імʼя або телефон',
        leads: 'Код, телефон, ПІБ або дата',
        empty: 'Спробуйте інший код, телефон, дату або імʼя клієнта.',
      },
      pl: {
        calendar: 'Kod, imię lub telefon',
        leads: 'Kod, telefon, imię lub data',
        empty: 'Spróbuj innego kodu, telefonu, daty lub imienia klienta.',
      },
    } as const;

    for (const code of ['en', 'uk', 'pl'] as const) {
      locale.set(code);
      await i18n.ensureLoaded(code);
      expect(i18n.t('calendar.clientSearch')).toBe(hints[code].calendar);
      expect(i18n.t('leads.searchPlaceholder')).toBe(hints[code].leads);
      expect(i18n.t('leads.emptyHint')).toBe(hints[code].empty);
    }
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
