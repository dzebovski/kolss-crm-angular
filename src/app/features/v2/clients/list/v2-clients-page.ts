import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import type { ClientListQuery } from '@core/api/generated/kolss-api.types';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { isOfficeId, OFFICE_CONFIG } from '@core/office/office.config';
import { SessionService } from '@core/session/session.service';
import type { V2ClientFilter, V2ClientListItem } from '@domain/v2/client.types';
import { v2PluralCategory } from '@domain/v2/plural';
import { V2ClientsService } from '@services/v2/v2-clients.service';
import { V2_NOW } from '../../core/v2-clock';
import { V2CreateLeadLauncher } from '../../leads/list/v2-create-lead-launcher';
import { V2Button } from '../../ui/v2-button';
import { V2SalesTabs } from '../../ui/v2-sales-tabs';
import { V2SearchField } from '../../ui/v2-search-field';
import { V2SegmentedControl, type V2SegmentOption } from '../../ui/v2-segmented-control';
import { V2Select, type V2SelectOption } from '../../ui/v2-select';
import { V2StatePanel } from '../../ui/v2-state-panel';
import {
  parseV2ClientsQuery,
  toV2ClientsQueryParams,
  type V2ClientsQuery,
} from './v2-clients-query';
import { V2ClientsTable } from './v2-clients-table';

/** URL update delay after typing in search, as the leads list; also debounces the fetch. */
const SEARCH_URL_DELAY_MS = 300;

const SORT_OPTIONS = [
  { value: 'new', key: 'v2.clients.sort.new' },
  { value: 'old', key: 'v2.clients.sort.old' },
  { value: 'name', key: 'v2.clients.sort.name' },
  { value: 'projects', key: 'v2.clients.sort.projects' },
] as const;

type ClientsFilters = Omit<ClientListQuery, 'limit' | 'cursor'>;

// Clients list from the "KOLSS CRM v2" canvas (Clients-list.dc.html and its loading / empty /
// error boards): title row with the Sales tabs, result count, search + chips, the table with
// "Show more". Data comes from `GET /v1/clients` (30 per page, cursor) and `/facets` through
// `V2ClientsService`; search and the chip live in the query params.
@Component({
  selector: 'app-v2-clients-page',
  imports: [
    TranslatePipe,
    V2Button,
    V2ClientsTable,
    V2SalesTabs,
    V2SearchField,
    V2SegmentedControl,
    V2Select,
    V2StatePanel,
  ],
  templateUrl: './v2-clients-page.html',
  styleUrl: './v2-clients-page.scss',
})
export class V2ClientsPage {
  private readonly clients = inject(V2ClientsService);
  private readonly session = inject(SessionService);
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(V2_NOW);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly createLead = inject(V2CreateLeadLauncher);

  // Query params, bound by `withComponentInputBinding()`.
  readonly q = input<string>();
  readonly filter = input<string>();

  protected readonly query = computed(() =>
    parseV2ClientsQuery({ q: this.q(), filter: this.filter() }),
  );

  /** What the search field shows; follows the URL except for our own delayed write. */
  protected readonly searchText = linkedSignal<string, string>({
    source: () => this.query().q,
    computation: (q, previous) => (previous && q === this.writtenQ ? previous.value : q),
  });
  private writtenQ: string | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly filters = computed<ClientsFilters>(() => ({
    officeId: this.session.selectedOfficeId() ?? undefined,
    q: this.query().q.trim() || undefined,
    filter: this.query().filter,
  }));

  private readonly listResource = resource({
    params: () => this.filters(),
    loader: ({ params }) => this.clients.list(params, ''),
  });
  private readonly facetsResource = resource({
    params: () => this.filters(),
    loader: ({ params }) => this.clients.facets(params),
  });

  // "Show more" rows and cursor; reset whenever the filters change identity.
  private readonly moreItems = linkedSignal<ClientsFilters, readonly V2ClientListItem[]>({
    source: () => this.filters(),
    computation: () => [],
  });
  private readonly moreCursor = linkedSignal<ClientsFilters, string | null>({
    source: () => this.filters(),
    computation: () => null,
  });
  protected readonly loadingMore = linkedSignal<ClientsFilters, boolean>({
    source: () => this.filters(),
    computation: () => false,
  });
  protected readonly moreError = linkedSignal<ClientsFilters, string>({
    source: () => this.filters(),
    computation: () => '',
  });

  private readonly nextCursor = computed(() => {
    const manual = this.moreCursor();
    if (manual !== null) return manual;
    return (this.listResource.hasValue() ? this.listResource.value().nextCursor : null) ?? '';
  });
  protected readonly hasMore = computed(() => this.nextCursor() !== '');

  protected readonly now = computed(() => {
    this.listResource.status();
    return this.clock();
  });
  protected readonly loading = computed(
    () => this.listResource.isLoading() && !this.listResource.hasValue(),
  );
  protected readonly loaded = computed(() => this.listResource.hasValue());
  protected readonly loadError = computed(() => {
    if (this.listResource.status() !== 'error') return '';
    const error = this.listResource.error();
    const message = error instanceof Error ? this.i18n.localizeError(error.message) : '';
    return message || this.i18n.t('v2.clients.error.hint');
  });

  protected readonly shown = computed<readonly V2ClientListItem[]>(() => [
    ...(this.listResource.hasValue() ? this.listResource.value().items : []),
    ...this.moreItems(),
  ]);
  private readonly facets = computed(() =>
    this.facetsResource.hasValue() ? this.facetsResource.value() : null,
  );
  /** Every client matching the current search and chip, not just the loaded rows. */
  protected readonly total = computed(() => this.facets()?.total ?? this.shown().length);

  protected readonly filtersActive = computed(() => this.query().q.trim() !== '');
  /** Zero clients in the office(s): no search, All clients and nothing came back. */
  protected readonly isEmpty = computed(
    () =>
      this.loaded() &&
      this.shown().length === 0 &&
      !this.filtersActive() &&
      this.query().filter === 'all',
  );
  protected readonly noResults = computed(
    () => this.loaded() && this.shown().length === 0 && !this.isEmpty(),
  );

  protected readonly segments = computed<readonly V2SegmentOption<V2ClientFilter>[]>(() => {
    this.i18n.locale();
    const facets = this.facets();
    return [
      { value: 'all', label: this.i18n.t('v2.clients.filter.all'), count: facets?.filter.all },
      {
        value: 'with_projects',
        label: this.i18n.t('v2.clients.filter.withProjects'),
        count: facets?.filter.with_projects,
      },
      {
        value: 'leads_only',
        label: this.i18n.t('v2.clients.filter.leadsOnly'),
        count: facets?.filter.leads_only,
      },
    ];
  });

  // TODO(v2): sorting is drawn (Newest / Oldest first, Name A-Z, Most projects) but the API only
  // returns the newest clients first; the control stays disabled until it gets a sort parameter.
  protected readonly sortOptions = computed<readonly V2SelectOption[]>(() => {
    this.i18n.locale();
    return SORT_OPTIONS.map(({ value, key }) => ({ value, label: this.i18n.t(key) }));
  });

  protected readonly countLabel = computed(() =>
    this.i18n.t(`v2.clients.count.${v2PluralCategory(this.i18n.locale(), this.total())}`, {
      count: this.total(),
    }),
  );
  protected readonly countContext = computed(() => {
    const filter = this.session.officeFilter();
    return this.i18n.t('v2.clients.context', {
      office: this.i18n.t(isOfficeId(filter) ? OFFICE_CONFIG[filter].nameKey : 'office.all'),
    });
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  protected retry(): void {
    this.listResource.reload();
    this.facetsResource.reload();
  }

  protected openCreateLead(): void {
    void this.createLead.open();
  }

  /** One request at the current cursor, appended to the rows; a response for old filters is dropped. */
  protected showMore(): void {
    if (this.loadingMore()) return;
    const cursor = this.nextCursor();
    if (!cursor) return;
    const requestFilters = this.filters();
    this.loadingMore.set(true);
    this.moreError.set('');
    this.clients.list(requestFilters, cursor).then(
      (page) => {
        const stale = requestFilters !== this.filters();
        this.loadingMore.set(false);
        if (stale) return;
        this.moreItems.update((items) => [...items, ...page.items]);
        this.moreCursor.set(page.nextCursor ?? '');
      },
      (error: unknown) => {
        const stale = requestFilters !== this.filters();
        this.loadingMore.set(false);
        if (stale) return;
        this.moreError.set(error instanceof Error ? this.i18n.localizeError(error.message) : '');
      },
    );
  }

  protected onSearch(text: string): void {
    this.searchText.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.navigate({ q: text }), SEARCH_URL_DELAY_MS);
  }

  protected onFilter(filter: V2ClientFilter): void {
    this.navigate({ filter });
  }

  private navigate(patch: Partial<V2ClientsQuery>): void {
    const queryParams = toV2ClientsQueryParams({ ...this.query(), q: this.searchText(), ...patch });
    this.writtenQ = queryParams['q'] ?? '';
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }
}
