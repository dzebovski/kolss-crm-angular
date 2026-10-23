import type { UpdateClientRequest } from '@core/api/generated/kolss-api.types';
import { OFFICE_CONFIG } from '@core/office/office.config';
import type { V2Client, V2ClientLanguage } from './client.types';
import { v2FormatPhoneInput, v2PhoneInfo, V2_PHONE_NATIONAL_DIGITS } from './phone-mask';

export const V2_CLIENT_LANGUAGES: readonly V2ClientLanguage[] = ['pl', 'uk', 'en', 'ru'];

/** What the Edit client popup edits; phones are in the mask's display form. */
export interface V2ClientForm {
  name: string;
  phone: string;
  secondPhone: string;
  email: string;
  address: string;
  language: V2ClientLanguage | '';
  about: string;
}

export function v2ClientFormFrom(client: V2Client): V2ClientForm {
  const code = OFFICE_CONFIG[client.officeId].phoneCountryCode;
  return {
    name: client.name,
    phone: client.rawPhone ? v2FormatPhoneInput(client.rawPhone, code) : '',
    secondPhone: client.secondPhone ? v2FormatPhoneInput(client.secondPhone, code) : '',
    email: client.email ?? '',
    address: client.address ?? '',
    language: client.language ?? '',
    about: client.about ?? '',
  };
}

/** `+48601334812` for a complete +48 / +380 number, null otherwise (the API's phone format). */
export function v2ClientApiPhone(value: string): string | null {
  const { cc, rest } = v2PhoneInfo(value);
  return cc && rest.length === V2_PHONE_NATIONAL_DIGITS ? `${cc}${rest}` : null;
}

function digitsOnly(value: string | null): string {
  return (value ?? '').replace(/\D/g, '');
}

function text(value: string | null): string {
  return (value ?? '').trim();
}

/** Only the fields that differ from the loaded client, in the PATCH body's shape. */
export function v2ClientChanges(form: V2ClientForm, client: V2Client): UpdateClientRequest {
  const phone = v2ClientApiPhone(form.phone);
  const secondPhone = form.secondPhone.trim() ? v2ClientApiPhone(form.secondPhone) : null;
  return {
    ...(form.name.trim() !== client.name.trim() ? { name: form.name.trim() } : {}),
    ...(phone && digitsOnly(phone) !== digitsOnly(client.rawPhone) ? { phone } : {}),
    ...(digitsOnly(secondPhone) !== digitsOnly(client.secondPhone) ? { secondPhone } : {}),
    ...(text(form.email) !== text(client.email) ? { email: text(form.email) || null } : {}),
    ...(text(form.address) !== text(client.address) ? { address: text(form.address) || null } : {}),
    ...(form.language !== (client.language ?? '') ? { language: form.language || null } : {}),
    ...(text(form.about) !== text(client.about) ? { about: text(form.about) || null } : {}),
  };
}

export function v2ClientChangeCount(form: V2ClientForm, client: V2Client): number {
  return Object.keys(v2ClientChanges(form, client)).length;
}

/** The two clients of a merge, the older one first: it survives whichever page started the merge. */
export function v2MergeSides(a: V2Client, b: V2Client): { older: V2Client; newer: V2Client } {
  const aIsOlder = a.createdAt < b.createdAt || (a.createdAt === b.createdAt && a.id < b.id);
  return aIsOlder ? { older: a, newer: b } : { older: b, newer: a };
}

export type V2MergeField = 'email' | 'address' | 'about';
export const V2_MERGE_FIELDS: readonly V2MergeField[] = ['email', 'address', 'about'];

/** Fields whose values differ between the two clients, so there is something to choose. */
export function v2MergeDifferingFields(older: V2Client, newer: V2Client): V2MergeField[] {
  return V2_MERGE_FIELDS.filter((field) => text(older[field]) !== text(newer[field]));
}
