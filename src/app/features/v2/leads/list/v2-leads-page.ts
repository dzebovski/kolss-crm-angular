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
  countV2LeadChips,
  matchesV2LeadChips,
  matchesV2LeadSearch,
  V2_LEAD_PERIOD_DAYS,
  V2_LEAD_RATING_FILTERS,
  V2_LEAD_STATUS_FILTERS,
  v2PeriodStart,
  type V2LeadPeriod,
} from '@domain/v2/lead-list.rules';
import { toV2LeadListItem } from '@domain/v2/lead-view.mapper';
import type { V2LeadStatus } from '@domain/v2/lead-view.types';
import { v2PluralCategory } from '@domain/v2/plural';
import { LeadsService } from '@services/leads.service';
import { UsersService } from '@services/users.service';
import { V2_NOW } from '../../core/v2-clock';
import { V2_NAV_ITEMS, type V2NavLinkItem } from '../../shell/v2-nav.config';
import { V2Button } from '../../ui/v2-button';
import type { V2SegmentOption } from '../../ui/v2-segmented-control';
import { V2_RATING_LABEL, V2_STATUS_LABEL } from '../../ui/v2-tone';
import { V2LeadsFilters, type V2LeadChip } from './v2-leads-filters';
import { parseV2LeadsQuery, toV2LeadsQueryParams, type V2LeadsQuery } from './v2-leads-query';
import { V2LeadsTable } from './v2-leads-table';

/** URL update delay after typing in search, as the v1 list. */
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
// sub-tabs and Create lead, result count, filters, leads table. Data comes from the current API
// (`GET /v1/leads` for the office and period, every page, as v1 loads it) mapped to the v2 view
// model (D1). Search and chips filter that set in the browser, which also gives the chip counts
// and the period total; filter state lives in the query params.
@Component({
  selector: 'app-v2-leads-page',
  imports: [RouterLink, TranslatePipe, V2Button, V2LeadsFilters, V2LeadsTable],
  templateUrl: './v2-leads-page.html',
  styleUrl: './v2-leads-page.scss',
})
export class V2LeadsPage {
  private readonly leadsService = inject(LeadsService);
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

  protected readonly query = computed(() =>
    parseV2LeadsQuery({ q: this.q(), period: this.period(), status: this.status() }),
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

  private readonly leadsResource = resource({
    params: () => ({
      officeId: this.session.selectedOfficeId(),
      days: V2_LEAD_PERIOD_DAYS[this.query().period],
      archived: 'active' as const,
    }),
    loader: ({ params }) => this.leadsService.list(params),
  });

  // Manager names come from the employees list, as in v1.
  private readonly employeesResource = resource({
    loader: () => this.usersService.listManagers(),
  });

  /** Taken when the leads arrive, so ages stay stable between reloads. */
  protected readonly now = computed(() => {
    this.leadsResource.value();
    return this.clock();
  });

  protected readonly leads = computed(() => {
    const names = new Map(
      (this.employeesResource.value() ?? []).map((employee) => [employee.id, employee.displayName]),
    );
    return (this.leadsResource.value() ?? []).map((lead) =>
      toV2LeadListItem(lead, { managerName: (id) => names.get(id) ?? null }),
    );
  });

  private readonly searched = computed(() => {
    const text = this.searchText();
    return this.leads().filter((lead) => matchesV2LeadSearch(lead, text));
  });

  private readonly chipFilters = computed(() => ({
    statuses: this.query().statuses,
    // TODO(W2): rating filter once the API stores the rating.
    ratings: [],
  }));

  protected readonly shownLeads = computed(() =>
    this.searched().filter((lead) => matchesV2LeadChips(lead, this.chipFilters())),
  );

  protected readonly filtersActive = computed(
    () => this.searchText().trim() !== '' || this.chipFilters().statuses.length > 0,
  );

  protected readonly periodOptions = computed<readonly V2SegmentOption<V2LeadPeriod>[]>(() => {
    this.i18n.locale();
    return (Object.keys(PERIOD_LABEL) as V2LeadPeriod[]).map((value) => ({
      value,
      label: this.i18n.t(PERIOD_LABEL[value]),
      // TODO(v2): the custom range picker is not in the design yet.
      disabled: value === 'custom',
    }));
  });

  protected readonly rangeLabel = computed(() => {
    const days = V2_LEAD_PERIOD_DAYS[this.query().period] ?? 0;
    const today = this.now();
    return `${formatV2ReportDate(v2PeriodStart(today, days))} – ${formatV2ReportDate(today)}`;
  });

  private readonly chipCounts = computed(() =>
    countV2LeadChips(this.searched(), this.chipFilters()),
  );

  protected readonly statusChips = computed<readonly V2LeadChip<V2LeadStatus>[]>(() =>
    V2_LEAD_STATUS_FILTERS.map((value) => ({
      value,
      labelKey: V2_STATUS_LABEL[value],
      count: this.chipCounts().statuses[value],
      selected: this.chipFilters().statuses.includes(value),
    })),
  );

  // Rating chips stay disabled and without counts until W2.
  protected readonly ratingChips = V2_LEAD_RATING_FILTERS.map((value) => ({
    value,
    labelKey: V2_RATING_LABEL[value],
    count: null,
    selected: false,
  }));

  protected readonly shownCount = computed(() => this.shownLeads().length);
  protected readonly shownNoun = computed(() =>
    this.i18n.t(`v2.leads.shown.${v2PluralCategory(this.i18n.locale(), this.shownCount())}`),
  );
  protected readonly shownContext = computed(() =>
    this.filtersActive()
      ? this.i18n.t('v2.leads.ofInPeriod', {
          total: this.leads().length,
          office: this.officeLabel(),
        })
      : this.i18n.t('v2.leads.inPeriod', { office: this.officeLabel() }),
  );

  private readonly officeLabel = computed(() => {
    const filter = this.session.officeFilter();
    return this.i18n.t(isOfficeId(filter) ? OFFICE_CONFIG[filter].nameKey : 'office.all');
  });

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

  /** Clears search and chips; the period stays, as on the board. */
  protected clearFilters(): void {
    clearTimeout(this.searchTimer);
    this.searchText.set('');
    this.navigate({ q: '', statuses: [] });
  }

  private navigate(patch: Partial<V2LeadsQuery>): void {
    const queryParams = toV2LeadsQueryParams({ ...this.query(), q: this.searchText(), ...patch });
    this.writtenQ = queryParams['q'] ?? '';
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }
}
