import type { V2LeadListItem } from './lead-view.types';

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
