/** Stable keys for lead edit audit — stored in DB, translated at display time. */
export const LEAD_FIELD_KEYS = [
  'name',
  'phone',
  'email',
  'cityRegion',
  'product',
  'budget',
  'initialMessage',
  'manager',
  'closeReason',
  'message',
  'type',
] as const;

export type LeadFieldKey = (typeof LEAD_FIELD_KEYS)[number];

export function isLeadFieldKey(value: string): value is LeadFieldKey {
  return (LEAD_FIELD_KEYS as readonly string[]).includes(value);
}

/** Maps legacy Ukrainian audit labels to stable keys. */
export const LEGACY_FIELD_KEY_MAP: Record<string, LeadFieldKey> = {
  "імʼя": 'name',
  імя: 'name',
  телефон: 'phone',
  email: 'email',
  'місто/район': 'cityRegion',
  продукт: 'product',
  бюджет: 'budget',
  'початкове повідомлення': 'initialMessage',
  менеджер: 'manager',
  'причина закриття': 'closeReason',
  коментар: 'message',
  повідомлення: 'message',
  тип: 'type',
};

export function normalizeFieldKey(value: string): LeadFieldKey | string {
  return LEGACY_FIELD_KEY_MAP[value] ?? (isLeadFieldKey(value) ? value : value);
}
