import { inject, Injectable } from '@angular/core';

import type { LocaleCode } from '../../services/crm-mock.types';
import { SessionService } from '../session/session.service';
import {
  compareForLocale,
  formatDateForLocale,
  formatDateTimeForLocale,
  formatMoneyForLocale,
  formatMonthYearForLocale,
} from './locale-format';
import { messages, type MessageKey, type MessageParams, translateMessage } from './messages';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly session = inject(SessionService);

  locale(): LocaleCode {
    return this.session.locale();
  }

  t(key: MessageKey, params?: MessageParams): string {
    return translateMessage(key, this.locale(), params);
  }

  tField(
    row: Record<string, unknown> | null | undefined,
    base: string,
    fallback = '',
  ): string {
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
    const key = `field.${fieldKey}` as MessageKey;
    if (key in messages) {
      return this.t(key);
    }
    return fieldKey;
  }

  formatDate(value: string | null | undefined): string {
    return formatDateForLocale(value, this.locale());
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

  sourceLabel(source: string): string {
    return this.t(`source.${source}` as MessageKey);
  }

  closeReasonLabel(
    code: string,
    reasons?: readonly { readonly code: string; readonly label_uk: string; readonly label_pl: string }[],
  ): string {
    const key = `closeReason.${code}` as MessageKey;
    if (key in messages) return this.t(key);
    const fromDb = reasons?.find((item) => item.code === code);
    if (fromDb) {
      return this.tField(fromDb as unknown as Record<string, unknown>, 'label', code);
    }
    return code;
  }

  roleLabel(role: string): string {
    const key = `role.${role}` as MessageKey;
    if (key in messages) return this.t(key);
    return role;
  }

  officeFilterLabel(filter: string): string {
    if (filter === 'all') return this.t('office.all');
    const key = `office.${filter}` as MessageKey;
    if (key in messages) return this.t(key);
    return filter;
  }

  firstCallResultLabel(code: string): string {
    const key = `firstCall.${code}` as MessageKey;
    if (key in messages) return this.t(key);
    return code;
  }

  eventTitle(eventType: string): string {
    const key = `event.${eventType}` as MessageKey;
    if (key in messages) return this.t(key);
    return eventType;
  }

  localizeError(message: string): string {
    if (message.startsWith('error.lossReasonMissing:')) {
      const reason = message.slice('error.lossReasonMissing:'.length);
      return this.t('error.lossReasonMissing', { reason });
    }
    if (message in messages) return this.t(message as MessageKey);
    return message;
  }
}
