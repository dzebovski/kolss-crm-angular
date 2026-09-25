import { inject, Service } from '@angular/core';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import type { LeadFacetsResponse } from '@core/api/generated/kolss-api.types';
import { v2LeadColumnsFromRow } from '@domain/v2/lead-card.mapper';
import { toV2LeadListItem } from '@domain/v2/lead-view.mapper';
import type { V2LeadListItem, V2LeadRating, V2LeadStatus } from '@domain/v2/lead-view.types';
import { mapLeadListRow } from '@services/leads.mapper';

/** 30 leads per request (D10, provisional — confirm with the user on the L4 review). */
export const V2_LEADS_PAGE_SIZE = 30;

/** Leads-list filters that go straight to `GET /v1/leads` and `GET /v1/leads/facets`. */
export interface V2LeadsListFilters {
  readonly officeId: string | null;
  /** Preset period length in days; `null` = no period filter (only for a future custom range). */
  readonly days: number | null;
  readonly search: string;
  readonly statuses: readonly V2LeadStatus[];
  readonly ratings: readonly V2LeadRating[];
}

export interface V2LeadsPage {
  readonly items: readonly V2LeadListItem[];
  readonly nextCursor: string;
}

export interface V2LeadsAccumulated {
  readonly items: readonly V2LeadListItem[];
  readonly hasMore: boolean;
}

/**
 * Data access for the v2 leads list (L4). Reads `GET /v1/leads` (paged, 30/request) and
 * `GET /v1/leads/facets` (chip counts + totals), mapping rows to the v2 view model here so
 * the page component never touches `KolssApiClient` directly.
 */
@Service()
export class V2LeadsListService {
  private readonly api = inject(KolssApiClient);

  /** One page. `managerName` on the returned items is always `null`; the page resolves it. */
  async list(filters: V2LeadsListFilters, cursor: string): Promise<V2LeadsPage> {
    const response = await this.api.listLeads({
      ...this.filterParams(filters),
      cursor: cursor || undefined,
      limit: V2_LEADS_PAGE_SIZE,
    });
    return {
      items: response.items.map((row) =>
        toV2LeadListItem(mapLeadListRow(row), v2LeadColumnsFromRow(row)),
      ),
      nextCursor: response.nextCursor,
    };
  }

  /**
   * Fetches `pages` pages from the start (re-fetching earlier pages too): "Show more" asks for
   * one more page than before, so the whole accumulated list is always internally consistent —
   * no client-side merge to get wrong. Active lead counts are in the low hundreds per office
   * (see `LeadsService`), so re-fetching a handful of 30-row pages on each click is cheap.
   */
  async listPages(filters: V2LeadsListFilters, pages: number): Promise<V2LeadsAccumulated> {
    const items: V2LeadListItem[] = [];
    let cursor = '';
    for (let page = 0; page < pages; page += 1) {
      const result = await this.list(filters, cursor);
      items.push(...result.items);
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    return { items, hasMore: cursor !== '' };
  }

  /** Chip counts and total for the current filters (no cursor/limit: it ignores paging). */
  facets(filters: V2LeadsListFilters): Promise<LeadFacetsResponse> {
    return this.api.leadFacets(this.filterParams(filters));
  }

  private filterParams(
    filters: V2LeadsListFilters,
  ): Record<string, string | number | readonly string[] | null | undefined> {
    return {
      officeId: filters.officeId ?? undefined,
      search: filters.search.trim() || undefined,
      v2Status: filters.statuses.length > 0 ? filters.statuses : undefined,
      rating: filters.ratings.length > 0 ? filters.ratings : undefined,
      days: filters.days ?? undefined,
    };
  }
}
