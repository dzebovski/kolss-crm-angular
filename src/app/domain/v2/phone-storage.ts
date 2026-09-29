import { normalizePhoneForOffice } from '@core/phone/phone';
import type { OfficeId } from '@domain/office.types';
import { v2PhoneInfo } from './phone-mask';

/**
 * Storage form of a phone typed in a v2 popup. The popups accept either country code for any
 * showroom, so the number's own code decides the format; the showroom is only the fallback for a
 * number without a recognised code. Returns null when the number is not a full valid phone.
 */
export function v2StoredPhone(value: string, fallbackOffice: OfficeId): string | null {
  const { cc } = v2PhoneInfo(value);
  const office: OfficeId = cc === '+380' ? 'kyiv' : cc === '+48' ? 'warsaw' : fallbackOffice;
  return normalizePhoneForOffice(value, office);
}
