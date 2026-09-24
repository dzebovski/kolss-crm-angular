import type { Lead } from '@domain/lead.types';
import type { V2LeadBudget, V2LeadCard, V2LeadColumns, V2LeadProduct } from './lead-card.types';
import { deriveV2LeadStatus, channelFromSource } from './lead-view.mapper';
import type { V2LeadChannel, V2LeadRating, V2LeadStatus } from './lead-view.types';

// v1 mapper placeholders for a missing name / phone (`leads.mapper.ts`).
const NO_NAME = 'Без імені';
const NO_PHONE = '—';

const V2_STATUSES: readonly V2LeadStatus[] = [
  'new',
  'later',
  'noanswer',
  'success',
  'thinking',
  'invited',
  'lost',
  'project',
];
const RATINGS: readonly V2LeadRating[] = ['cold', 'medium', 'hot'];
const CHANNELS: readonly V2LeadChannel[] = [
  'referral',
  'phone',
  'office',
  'website',
  'meta_ads',
  'google_ads',
  'other',
];
export const V2_LEAD_PRODUCTS: readonly V2LeadProduct[] = [
  'kitchen',
  'wardrobe',
  'furniture',
  'bathroom',
  'hallway',
  'other',
];

/** Reads the v2 columns from a raw lead row; unknown or missing values become null / empty. */
export function v2LeadColumnsFromRow(row: unknown): V2LeadColumns {
  const record = isRecord(row) ? row : {};
  const attempts = record['no_answer_attempts'];
  const products = record['products'];
  return {
    v2Status: oneOf(record['v2_status'], V2_STATUSES),
    v2StatusChangedAt: text(record['v2_status_changed_at']),
    rating: oneOf(record['rating'], RATINGS),
    channel: oneOf(record['channel'], CHANNELS),
    noAnswerAttempts: typeof attempts === 'number' && attempts > 0 ? attempts : 0,
    estimatedBudgetText: text(record['estimated_budget_text']),
    products: Array.isArray(products)
      ? V2_LEAD_PRODUCTS.filter((product) => products.includes(product))
      : [],
  };
}

export function toV2LeadCard(lead: Lead, columns: V2LeadColumns): V2LeadCard {
  const name = lead.name === NO_NAME ? '' : lead.name.trim();
  const phone = lead.phone === NO_PHONE ? '' : lead.phone.trim();
  const status = columns.v2Status ?? deriveV2LeadStatus(lead.clientStatus, lead.callStatus);
  return {
    id: lead.id,
    version: lead.version ?? 1,
    archived: Boolean(lead.archivedAt),
    code: lead.referenceId.toUpperCase(),
    name,
    initials: v2Initials(name),
    phone,
    phoneHref: phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null,
    email: lead.email?.trim() || null,
    location: lead.cityRegion.trim() || null,
    budget: v2LeadBudget(lead, columns),
    products: columns.products,
    productText: columns.products.length ? null : lead.productInterest.trim() || null,
    managerId: lead.assignedToId,
    officeId: lead.officeCode,
    channel: columns.channel ?? channelFromSource(lead.source),
    status,
    projectAt: status === 'project' ? columns.v2StatusChangedAt : null,
    rating: columns.rating,
    createdAt: lead.sourceCreatedAt,
    lastUpdate: v2LeadLastUpdate(lead),
  };
}

/** `Olena Kowal` → `OK`; one word → its first letter. */
export function v2Initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : '';
  return (first + last).toLocaleUpperCase();
}

/**
 * First / last name for Edit contact info. The lead stores one `name` (contract decision:
 * first and last name are joined), so the first word is the first name and the rest the last.
 */
export function splitV2Name(name: string): { readonly first: string; readonly last: string } {
  const trimmed = name.trim();
  const space = trimmed.search(/\s/);
  if (space < 0) return { first: trimmed, last: '' };
  return { first: trimmed.slice(0, space), last: trimmed.slice(space).trim() };
}

export function joinV2Name(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(' ');
}

/**
 * The design's budget text wins (a number or a range as typed); otherwise the v1 number,
 * grouped by thousands with a space (`22 000`) as in the design.
 */
function v2LeadBudget(lead: Lead, columns: V2LeadColumns): V2LeadBudget | null {
  const currency = lead.estimatedBudgetCurrency;
  if (columns.estimatedBudgetText) return { amount: columns.estimatedBudgetText, currency };
  if (lead.estimatedBudget == null) return null;
  return { amount: groupThousands(lead.estimatedBudget), currency };
}

function groupThousands(value: number): string {
  const [whole, fraction] = String(value).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fraction ? `${grouped},${fraction}` : grouped;
}

/** The latest timeline event (who changed what last); the lead's arrival when there is none. */
function v2LeadLastUpdate(lead: Lead): V2LeadCard['lastUpdate'] {
  let latest: Lead['events'][number] | null = null;
  for (const event of lead.events) {
    if (!latest || event.occurredAt > latest.occurredAt) latest = event;
  }
  if (!latest) return { at: lead.sourceCreatedAt, actorName: '' };
  return { at: latest.occurredAt, actorName: latest.actorName?.trim() ?? '' };
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Budget as the design writes it: amount, then the currency sign (`22 000 – 25 000 zł`). */
export function formatV2Budget(budget: V2LeadBudget, locale: string): string {
  return `${budget.amount} ${currencySign(budget.currency, locale)}`;
}

function currencySign(currency: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}
