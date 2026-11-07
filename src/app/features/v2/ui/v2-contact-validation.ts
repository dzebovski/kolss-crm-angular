import type { I18nService } from '@core/i18n/i18n.service';
import type { V2LeadChannel } from '@domain/v2/lead-view.types';
import type { V2PhoneValidation } from '@domain/v2/phone-mask';

// Contact checks shared by Edit contact info, Create project and Edit client.

/** Channels a person may pick; `other` only stays when the lead already has it. */
export const V2_PICKABLE_CHANNELS: readonly V2LeadChannel[] = [
  'office',
  'phone',
  'website',
  'meta_ads',
  'google_ads',
  'referral',
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Email is optional; when given it must look like an address. */
export function v2EmailValid(value: string): boolean {
  const email = value.trim();
  return !email || EMAIL_PATTERN.test(email);
}

export function v2PhoneValidationMessage(result: V2PhoneValidation, i18n: I18nService): string {
  switch (result.kind) {
    case 'ok':
      return '';
    case 'empty':
      return i18n.t('v2.editContact.phoneRequired');
    case 'noCode':
      return i18n.t('v2.editContact.phoneCode');
    case 'incomplete':
      return i18n.t('v2.editContact.phoneIncomplete', { count: result.missingDigits });
  }
}
