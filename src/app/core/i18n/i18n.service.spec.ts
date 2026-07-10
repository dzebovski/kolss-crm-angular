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
});
