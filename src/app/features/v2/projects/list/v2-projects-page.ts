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
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { isOfficeId, OFFICE_CONFIG } from '@core/office/office.config';
import { SessionService } from '@core/session/session.service';
import { v2PluralCategory } from '@domain/v2/plural';
import type { V2ProjectListItem, V2ProjectStatus } from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { UsersService } from '@services/users.service';
import { V2_NOW } from '../../core/v2-clock';
import { V2Button } from '../../ui/v2-button';
import { V2EmptyState } from '../../ui/v2-empty-state';
import { V2SalesTabs } from '../../ui/v2-sales-tabs';
import { V2SegmentedControl, type V2SegmentOption } from '../../ui/v2-segmented-control';
import { V2StatePanel } from '../../ui/v2-state-panel';
import { V2ProjectsFilters, v2ManagerOptions, v2ProjectChips } from './v2-projects-filters';
import { V2ProjectsKanban } from './v2-projects-kanban';
import {
  parseV2ProjectsQuery,
  toV2ProjectsApiQuery,
  toV2ProjectsQueryParams,
  type V2ProjectsFilterSet as Filters,
  type V2ProjectsQuery,
  type V2ProjectsView,
} from './v2-projects-query';
import { V2ProjectsTable } from './v2-projects-table';

/** 30 projects per request, as the leads list; "Show more" appends the next page. */
const PAGE_SIZE = 30;
/** URL update delay after typing in search, as the leads list; also debounces the server fetch. */
const SEARCH_URL_DELAY_MS = 300;

// Projects list from the "KOLSS CRM v2" canvas (Projects-list + -empty / -error / -loading
// boards): title row with the Sales sub-tabs and New project, result count with the List /
// Kanban switch (not drawn, owner decision 2026-10-23), filters, then the table or the kanban.
// List data: `GET /v1/projects` (cursor paging, 30 rows) and `GET /v1/projects/facets` (chip
// counts + total); the kanban loads its own board. Filter state and the view live in the URL.
@Component({
  selector: 'app-v2-projects-page',
  imports: [
    RouterLink,
    TranslatePipe,
    V2Button,
    V2EmptyState,
    V2ProjectsFilters,
    V2ProjectsKanban,
    V2ProjectsTable,
    V2SalesTabs,
    V2SegmentedControl,
    V2StatePanel,
  ],
  templateUrl: './v2-projects-page.html',
  styleUrl: './v2-projects-page.scss',
})
export class V2ProjectsPage {
  private readonly projects = inject(V2ProjectsService);
  private readonly usersService = inject(UsersService);
  private readonly session = inject(SessionService);
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(V2_NOW);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Query params, bound by `withComponentInputBinding()`.
  readonly view = input<string>();
  readonly q = input<string>();
  readonly manager = input<string>();
  readonly status = input<string>();

  protected readonly query = computed(() =>
    parseV2ProjectsQuery({
      view: this.view(),
      q: this.q(),
      manager: this.manager(),
      status: this.status(),
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

  protected readonly kanban = computed(() => this.query().view === 'kanban');
  protected readonly viewOptions = computed<readonly V2SegmentOption<V2ProjectsView>[]>(() => [
    { value: 'list', label: this.i18n.t('v2.projects.view.list') },
    { value: 'kanban', label: this.i18n.t('v2.projects.view.kanban') },
  ]);

  /** The status chips do not apply to the kanban (every stage is a column). */
  protected readonly filters = computed<Filters>(() => ({
    officeId: this.session.selectedOfficeId(),
    q: this.query().q.trim(),
    managerId: this.query().manager,
    statuses: this.query().view === 'kanban' ? [] : this.query().statuses,
  }));

  /** The first page (list view only). Reloads on filter changes; discards stale loads. */
  private readonly listResource = resource({
    params: () => (this.kanban() ? undefined : this.filters()),
    loader: ({ params }) =>
      this.projects.list({ ...toV2ProjectsApiQuery(params), limit: PAGE_SIZE }),
  });

  /** Chip counts and the total for the current filters (the status counts ignore the chips). */
  private readonly facetsResource = resource({
    params: () => this.filters(),
    loader: ({ params }) => this.projects.facets(toV2ProjectsApiQuery(params)),
  });

  private readonly employeesResource = resource({ loader: () => this.usersService.listManagers() });

  // "Show more" state resets whenever `filters()` changes identity, so a filter change can never
  // leave a stale cursor, a stuck spinner or an old error behind.
  private readonly moreItems = linkedSignal<Filters, readonly V2ProjectListItem[]>({
    source: () => this.filters(),
    computation: () => [],
  });
  /** `null` = no "Show more" fetched yet for these filters; fall back to the first page's cursor. */
  private readonly moreCursor = linkedSignal<Filters, string | null>({
    source: () => this.filters(),
    computation: () => null,
  });
  protected readonly loadingMore = linkedSignal<Filters, boolean>({
    source: () => this.filters(),
    computation: () => false,
  });
  protected readonly moreError = linkedSignal<Filters, string>({
    source: () => this.filters(),
    computation: () => '',
  });

  private readonly nextCursor = computed(() => {
    const manual = this.moreCursor();
    if (manual !== null) return manual;
    return (this.listResource.hasValue() && this.listResource.value().nextCursor) || '';
  });
  protected readonly hasMore = computed(() => this.nextCursor() !== '');

  /** Taken when the projects arrive, so ages stay stable between reloads. */
  protected readonly now = computed(() => {
    this.listResource.status();
    return this.clock();
  });

  protected readonly loading = computed(
    () => this.listResource.isLoading() && !this.listResource.hasValue(),
  );
  protected readonly loaded = computed(() => this.listResource.hasValue());
  protected readonly failed = computed(() => this.listResource.status() === 'error');

  protected readonly shownProjects = computed<readonly V2ProjectListItem[]>(() => [
    ...(this.listResource.hasValue() ? this.listResource.value().items : []),
    ...this.moreItems(),
  ]);

  protected readonly filtersActive = computed(
    () =>
      this.query().q.trim() !== '' ||
      this.query().manager !== '' ||
      this.filters().statuses.length > 0,
  );
  /** Zero records at all (Projects-list-empty board): no filters and nothing came back. */
  protected readonly noProjects = computed(() => {
    if (this.filtersActive()) return false;
    if (this.kanban())
      return this.facetsResource.hasValue() && this.facetsResource.value().total === 0;
    return this.loaded() && this.shownProjects().length === 0;
  });
  /** Filters that match nothing: the smaller panel inside the table. */
  protected readonly noResults = computed(
    () => this.loaded() && this.filtersActive() && this.shownProjects().length === 0,
  );

  protected readonly managersLoading = computed(() => this.employeesResource.isLoading());
  protected readonly managerOptions = computed(() =>
    v2ManagerOptions(
      this.employeesResource.hasValue() ? this.employeesResource.value() : [],
      this.session.selectedOfficeId(),
      this.query().manager,
      this.i18n.t('v2.projects.allManagers'),
      this.i18n.locale(),
    ),
  );

  protected readonly statusChips = computed(() =>
    v2ProjectChips(
      this.facetsResource.hasValue() ? this.facetsResource.value() : null,
      this.query().statuses,
    ),
  );

  /** Every project matching the filters, not just the loaded ones; `null` until the counts arrive. */
  protected readonly total = computed(() =>
    this.facetsResource.hasValue()
      ? Math.max(this.facetsResource.value().total, this.shownProjects().length)
      : null,
  );
  protected readonly shownNoun = computed(() =>
    this.i18n.t(`v2.projects.shown.${v2PluralCategory(this.i18n.locale(), this.total() ?? 0)}`),
  );
  protected readonly officeLabel = computed(() => {
    const filter = this.session.officeFilter();
    return isOfficeId(filter)
      ? this.i18n.t(OFFICE_CONFIG[filter].nameKey)
      : this.i18n.t('v2.projects.allOffices');
  });

  /** "Show N more" (the next page's size) and "Showing X of Y" / "All Y shown". */
  protected readonly moreCount = computed(() => {
    const total = this.total();
    const remaining = total === null ? PAGE_SIZE : total - this.shownProjects().length;
    return Math.min(PAGE_SIZE, Math.max(remaining, 1));
  });
  protected readonly progress = computed(() => {
    const shown = this.shownProjects().length;
    const total = this.total() ?? shown;
    return this.hasMore()
      ? this.i18n.t('v2.projects.showing', { shown, total })
      : this.i18n.t('v2.projects.allShown', { total });
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  protected retry(): void {
    this.listResource.reload();
    this.facetsResource.reload();
  }

  /**
   * One `GET /v1/projects` request at the current cursor, appended to the loaded rows. Ignores a
   * double click while a request is in flight and drops the response if the filters changed.
   */
  protected showMore(): void {
    if (this.loadingMore()) return;
    const cursor = this.nextCursor();
    if (!cursor) return;
    const requestFilters = this.filters();
    this.loadingMore.set(true);
    this.moreError.set('');
    this.projects.list({ ...toV2ProjectsApiQuery(requestFilters), limit: PAGE_SIZE, cursor }).then(
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

  protected toggleStatus(status: V2ProjectStatus): void {
    const statuses = this.query().statuses;
    this.navigate({
      statuses: statuses.includes(status)
        ? statuses.filter((value) => value !== status)
        : [...statuses, status],
    });
  }

  protected onView(view: V2ProjectsView): void {
    this.navigate({ view });
  }

  /** From the kanban's "Completed: N": the list filtered by Completed. */
  protected openCompleted(): void {
    this.navigate({ view: 'list', statuses: ['completed'] });
  }

  /** From the kanban's "Closed: N": the list filtered by Closed. */
  protected openCancelled(): void {
    this.navigate({ view: 'list', statuses: ['cancelled'] });
  }

  protected onManager(manager: string): void {
    this.navigate({ manager });
  }

  /** Clears search, manager and chips. */
  protected clearFilters(): void {
    clearTimeout(this.searchTimer);
    this.searchText.set('');
    this.navigate({ q: '', manager: '', statuses: [] });
  }

  private navigate(patch: Partial<V2ProjectsQuery>): void {
    const queryParams = toV2ProjectsQueryParams({
      ...this.query(),
      q: this.searchText(),
      ...patch,
    });
    this.writtenQ = queryParams['q'] ?? '';
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }
}
