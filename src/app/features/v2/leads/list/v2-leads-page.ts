import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { isOfficeId, OFFICE_CONFIG } from '@core/office/office.config';
import { SessionService } from '@core/session/session.service';
import { formatV2ReportDate } from '@domain/v2/date-format';
import {
  V2_LEAD_PERIOD_DAYS,
  V2_LEAD_RATING_FILTERS,
  V2_LEAD_STATUS_FILTERS,
  v2PeriodStart,
  type V2LeadPeriod,
} from '@domain/v2/lead-list.rules';
import type { V2LeadRating, V2LeadStatus } from '@domain/v2/lead-view.types';
import { v2PluralCategory } from '@domain/v2/plural';
import { V2LeadsListService, type V2LeadsListFilters } from '@services/v2/v2-leads-list.service';
import { UsersService } from '@services/users.service';
import { V2_NOW } from '../../core/v2-clock';
import { V2_NAV_ITEMS, type V2NavLinkItem } from '../../shell/v2-nav.config';
import { V2Button } from '../../ui/v2-button';
import { V2EmptyState } from '../../ui/v2-empty-state';
import type { V2SegmentOption } from '../../ui/v2-segmented-control';
import { V2_RATING_LABEL, V2_STATUS_LABEL } from '../../ui/v2-tone';
import { V2LeadsFilters, type V2LeadChip } from './v2-leads-filters';
import { parseV2LeadsQuery, toV2LeadsQueryParams, type V2LeadsQuery } from './v2-leads-query';
import { V2LeadsTable } from './v2-leads-table';

/** URL update delay after typing in search, as the v1 list; also debounces the server fetch. */
const SEARCH_URL_DELAY_MS = 300;

const PERIOD_LABEL: Record<V2LeadPeriod, MessageKey> = {
  week: 'v2.leads.period.week',
  month: 'v2.leads.period.month',
  d40: 'v2.leads.period.d40',
  m6: 'v2.leads.period.m6',
  custom: 'v2.leads.period.custom',
};

const salesTab = (id: string): V2NavLinkItem =>
  V2_NAV_ITEMS.find((item): item is V2NavLinkItem => item.kind === 'link' && item.id === id)!;

// Leads home from the "KOLSS CRM v2" canvas (Main.dc.html, PAGE): title row with the Sales
// sub-tabs and Create lead, result count, filters, leads table. Data comes from
// `GET /v1/leads` (server paging, search, status/rating and period filters) and
// `GET /v1/leads/facets` (chip counts + totals) through `V2LeadsListService`; filter state
// lives in the query params, "Show more" appends the next 30-row page (D10, provisional).
@Component({
  selector: 'app-v2-leads-page',
  imports: [RouterLink, TranslatePipe, V2Button, V2EmptyState, V2LeadsFilters, V2LeadsTable],
  templateUrl: './v2-leads-page.html',
  styleUrl: './v2-leads-page.scss',
})
export class V2LeadsPage {
  private readonly leadsList = inject(V2LeadsListService);
  private readonly usersService = inject(UsersService);
  private readonly session = inject(SessionService);
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(V2_NOW);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Query params, bound by `withComponentInputBinding()`.
  readonly q = input<string>();
  readonly period = input<string>();
  readonly status = input<string>();
  readonly rating = input<string>();

  protected readonly query = computed(() =>
    parseV2LeadsQuery({
      q: this.q(),
      period: this.period(),
      status: this.status(),
      rating: this.rating(),
    }),
  );

  /**
   * What the search field shows. Follows the URL, except when the URL change is our own delayed
   * write: the viewer may have typed more since.
   */
  protected readonly searchText = linkedSignal<string, string>({
    source: () => this.query().q,
    computation: (q, previous) => (previous && q === this.writtenQ ? previous.value : q),
  });
  private writtenQ: string | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly tabs = [salesTab('leads'), salesTab('projects'), salesTab('clients')];

  /** The filters that go to the API. Search follows the URL, so the fetch is debounced too. */
  private readonly filters = computed<V2LeadsListFilters>(() => ({
    officeId: this.session.selectedOfficeId(),
    days: V2_LEAD_PERIOD_DAYS[this.query().period],
    search: this.query().q,
    statuses: this.query().statuses,
    ratings: this.query().ratings,
  }));

  /** Office + period only, ignoring search and chips: the "in this period" denominator. */
  private readonly periodFilters = computed<V2LeadsListFilters>(() => ({
    officeId: this.session.selectedOfficeId(),
    days: V2_LEAD_PERIOD_DAYS[this.query().period],
    search: '',
    statuses: [],
    ratings: [],
  }));

  /**
   * How many 30-row pages to show. Reset to 1 whenever the filters change identity (a new
   * search/period/chip selection); "Show more" bumps it without resetting.
   */
  private readonly requestedPages = linkedSignal<V2LeadsListFilters, number>({
    source: () => this.filters(),
    computation: () => 1,
  });

  private readonly leadsResource = resource({
    params: () => ({ filters: this.filters(), pages: this.requestedPages() }),
    loader: ({ params }) => this.leadsList.listPages(params.filters, params.pages),
  });

  // Manager names come from the employees list, as in v1; resolved here rather than baked into
  // the service's mapping, so a page fetched before the employees list arrives still gets names
  // once it does, without an extra round trip to the leads endpoint.
  private readonly employeesResource = resource({
    loader: () => this.usersService.listManagers(),
  });
  private readonly managerNames = computed(() => {
    const employees = this.employeesResource.hasValue() ? this.employeesResource.value() : [];
    return new Map(employees.map((employee) => [employee.id, employee.displayName]));
  });

  /** Chip counts + shown total: office/period/search/statuses/ratings, as `matchesV2LeadChips`. */
  private readonly chipFacetsResource = resource({
    params: () => this.filters(),
    loader: ({ params }) => this.leadsList.facets(params),
  });

  /** Period total (office/period only), for "N of M in this period". */
  private readonly periodFacetsResource = resource({
    params: () => this.periodFilters(),
    loader: ({ params }) => this.leadsList.facets(params),
  });

  /** Taken when the leads arrive, so ages stay stable between reloads. */
  protected readonly now = computed(() => {
    this.leadsResource.status();
    return this.clock();
  });

  /** First load or a new filter set: no rows to keep showing. */
  protected readonly loading = computed(
    () => this.leadsResource.isLoading() && !this.leadsResource.hasValue(),
  );
  protected readonly loaded = computed(() => this.leadsResource.hasValue());
  /** "Show more" was clicked and the next page hasn't arrived yet. */
  protected readonly loadingMore = computed(
    () => this.leadsResource.isLoading() && this.leadsResource.hasValue(),
  );
  protected readonly hasMore = computed(() =>
    this.leadsResource.hasValue() ? this.leadsResource.value().hasMore : false,
  );

  protected readonly loadError = computed(() => {
    if (this.leadsResource.status() !== 'error') return '';
    const error = this.leadsResource.error();
    return error instanceof Error ? this.i18n.localizeError(error.message) : '';
  });

  protected readonly shownLeads = computed(() => {
    const names = this.managerNames();
    const items = this.leadsResource.hasValue() ? this.leadsResource.value().items : [];
    return items.map((item) =>
      item.managerId ? { ...item, managerName: names.get(item.managerId) ?? null } : item,
    );
  });

  protected readonly filtersActive = computed(
    () =>
      this.query().q.trim() !== '' ||
      this.query().statuses.length > 0 ||
      this.query().ratings.length > 0,
  );

  protected readonly periodOptions = computed<readonly V2SegmentOption<V2LeadPeriod>[]>(() => {
    this.i18n.locale();
    return (Object.keys(PERIOD_LABEL) as V2LeadPeriod[]).map((value) => ({
      value,
      label: this.i18n.t(PERIOD_LABEL[value]),
      // TODO(v2): the custom range picker is not in the design yet (L5).
      disabled: value === 'custom',
    }));
  });

  protected readonly rangeLabel = computed(() => {
    const days = V2_LEAD_PERIOD_DAYS[this.query().period] ?? 0;
    const today = this.now();
    return `${formatV2ReportDate(v2PeriodStart(today, days))} – ${formatV2ReportDate(today)}`;
  });

  private readonly chipFacets = computed(() =>
    this.chipFacetsResource.hasValue() ? this.chipFacetsResource.value() : null,
  );

  protected readonly statusChips = computed<readonly V2LeadChip<V2LeadStatus>[]>(() => {
    const facets = this.chipFacets();
    return V2_LEAD_STATUS_FILTERS.map((value) => ({
      value,
      labelKey: V2_STATUS_LABEL[value],
      count: facets?.v2Status[value] ?? 0,
      selected: this.query().statuses.includes(value),
    }));
  });

  protected readonly ratingChips = computed<readonly V2LeadChip<V2LeadRating>[]>(() => {
    const facets = this.chipFacets();
    return V2_LEAD_RATING_FILTERS.map((value) => ({
      value,
      labelKey: V2_RATING_LABEL[value],
      count: facets?.rating[value] ?? 0,
      selected: this.query().ratings.includes(value),
    }));
  });

  /** The bold count in the result row: every lead matching the current filters, not just loaded. */
  protected readonly shownCount = computed(() =>
    this.chipFacetsResource.hasValue() ? this.chipFacetsResource.value().total : 0,
  );
  protected readonly shownNoun = computed(() =>
    this.i18n.t(`v2.leads.shown.${v2PluralCategory(this.i18n.locale(), this.shownCount())}`),
  );
  protected readonly shownContext = computed(() =>
    this.filtersActive()
      ? this.i18n.t('v2.leads.ofInPeriod', {
          total: this.periodFacetsResource.hasValue() ? this.periodFacetsResource.value().total : 0,
          office: this.officeLabel(),
        })
      : this.i18n.t('v2.leads.inPeriod', { office: this.officeLabel() }),
  );

  private readonly officeLabel = computed(() => {
    const filter = this.session.officeFilter();
    return this.i18n.t(isOfficeId(filter) ? OFFICE_CONFIG[filter].nameKey : 'office.all');
  });

  protected retry(): void {
    this.leadsResource.reload();
    this.chipFacetsResource.reload();
    this.periodFacetsResource.reload();
  }

  protected showMore(): void {
    this.requestedPages.update((pages) => pages + 1);
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  protected onSearch(text: string): void {
    this.searchText.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.navigate({ q: text }), SEARCH_URL_DELAY_MS);
  }

  protected onPeriod(period: V2LeadPeriod): void {
    this.navigate({ period });
  }

  protected toggleStatus(status: V2LeadStatus): void {
    const statuses = this.query().statuses;
    this.navigate({
      statuses: statuses.includes(status)
        ? statuses.filter((value) => value !== status)
        : [...statuses, status],
    });
  }

  protected toggleRating(rating: V2LeadRating): void {
    const ratings = this.query().ratings;
    this.navigate({
      ratings: ratings.includes(rating)
        ? ratings.filter((value) => value !== rating)
        : [...ratings, rating],
    });
  }

  /** Clears search and chips; the period stays, as on the board. */
  protected clearFilters(): void {
    clearTimeout(this.searchTimer);
    this.searchText.set('');
    this.navigate({ q: '', statuses: [], ratings: [] });
  }

  private navigate(patch: Partial<V2LeadsQuery>): void {
    const queryParams = toV2LeadsQueryParams({ ...this.query(), q: this.searchText(), ...patch });
    this.writtenQ = queryParams['q'] ?? '';
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }
}
