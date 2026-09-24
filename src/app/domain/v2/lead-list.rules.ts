import type { V2LeadListItem, V2LeadRating, V2LeadStatus } from './lead-view.types';

/** Leads of one calendar month (viewer's local time), newest first. */
export interface V2LeadMonthGroup {
  /** `YYYY-MM`, stable across reloads (used to remember collapsed groups). */
  readonly key: string;
  /** Any date inside the month, for the heading. */
  readonly month: Date;
  readonly items: readonly V2LeadListItem[];
}

/** Newest first by arrival, then split into month groups in that order (Leads board). */
export function groupV2LeadsByMonth(items: readonly V2LeadListItem[]): readonly V2LeadMonthGroup[] {
  const sorted = [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const groups: { key: string; month: Date; items: V2LeadListItem[] }[] = [];
  for (const item of sorted) {
    const date = new Date(item.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else
      groups.push({ key, month: new Date(date.getFullYear(), date.getMonth(), 1), items: [item] });
  }
  return groups;
}

/** Avatar initials as on the board: first letters of the first two words. */
export function v2Initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toLocaleUpperCase();
}

/** Period presets of the Leads board, in order. `custom` has no preset length. */
export type V2LeadPeriod = 'week' | 'month' | 'd40' | 'm6' | 'custom';

export const V2_LEAD_PERIOD_DAYS: Readonly<Record<V2LeadPeriod, number | null>> = {
  week: 7,
  month: 30,
  d40: 40,
  m6: 183,
  custom: null,
};

export const V2_DEFAULT_LEAD_PERIOD: V2LeadPeriod = 'd40';

/**
 * Status chips: New (user, 2026-09-24; not on the board) first, then the board order.
 * Project and the legacy statuses have no chip.
 */
export const V2_LEAD_STATUS_FILTERS: readonly V2LeadStatus[] = [
  'new',
  'success',
  'later',
  'noanswer',
  'thinking',
  'invited',
  'lost',
];

export const V2_LEAD_RATING_FILTERS: readonly V2LeadRating[] = ['cold', 'medium', 'hot'];

export interface V2LeadChipFilters {
  readonly statuses: readonly V2LeadStatus[];
  readonly ratings: readonly V2LeadRating[];
}

/**
 * Board search: the name or the code contains the text (case-insensitive), or, from three
 * digits on, the phone digits contain the typed digits.
 */
export function matchesV2LeadSearch(item: V2LeadListItem, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  if (item.name.toLocaleLowerCase().includes(needle)) return true;
  if (item.code.toLocaleLowerCase().includes(needle)) return true;
  const digits = needle.replace(/\D/g, '');
  return digits.length >= 3 && item.phone.replace(/\D/g, '').includes(digits);
}

/** Empty selection = no filter; otherwise the lead must match one of the selected values. */
export function matchesV2LeadChips(item: V2LeadListItem, filters: V2LeadChipFilters): boolean {
  return matchesStatus(item, filters.statuses) && matchesRating(item, filters.ratings);
}

/**
 * Chip counts as on the board: a status chip counts the searched leads that pass the rating
 * selection, and a rating chip those that pass the status selection.
 */
export function countV2LeadChips(
  items: readonly V2LeadListItem[],
  filters: V2LeadChipFilters,
): { statuses: Record<V2LeadStatus, number>; ratings: Record<V2LeadRating, number> } {
  const statuses = Object.fromEntries(V2_LEAD_STATUS_FILTERS.map((s) => [s, 0])) as Record<
    V2LeadStatus,
    number
  >;
  const ratings = { cold: 0, medium: 0, hot: 0 };
  for (const item of items) {
    const status = item.status as V2LeadStatus;
    if (status in statuses && matchesRating(item, filters.ratings)) statuses[status] += 1;
    if (item.rating && matchesStatus(item, filters.statuses)) ratings[item.rating] += 1;
  }
  return { statuses, ratings };
}

/** First day of a preset period ending today: `days` calendar days including today. */
export function v2PeriodStart(now: Date, days: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
}

function matchesStatus(item: V2LeadListItem, statuses: readonly V2LeadStatus[]): boolean {
  return statuses.length === 0 || statuses.includes(item.status as V2LeadStatus);
}

function matchesRating(item: V2LeadListItem, ratings: readonly V2LeadRating[]): boolean {
  return ratings.length === 0 || (item.rating !== null && ratings.includes(item.rating));
}
