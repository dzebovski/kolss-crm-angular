import { Component, computed, inject, input, linkedSignal, output, resource } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2Money } from '@domain/v2/project-money';
import {
  V2_PROJECT_STAGES,
  V2_PROJECT_STATUS_COLOR,
  v2ProjectStatusLabelKey,
} from '@domain/v2/project-status';
import type { V2ProjectListItem, V2ProjectStatus } from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { V2Button } from '../../ui/v2-button';
import { V2CodeChip } from '../../ui/v2-code-chip';
import { V2StatePanel } from '../../ui/v2-state-panel';
import { toV2ProjectsApiQuery, type V2ProjectsFilterSet } from './v2-projects-query';
import { toV2ProjectRow, type V2ProjectRow } from './v2-projects-rows';

/** Cards per column on load and per "Show more" (the API allows up to 50). */
const COLUMN_PAGE = 20;

/** Extra cards a column fetched with "Show more", reset whenever the filters change. */
interface ColumnMore {
  readonly items: readonly V2ProjectListItem[];
  readonly cursor: string | null;
  readonly loading: boolean;
  readonly error: string;
}

interface Card extends V2ProjectRow {
  readonly estimate: string;
}

interface Column {
  readonly status: V2ProjectStatus;
  readonly labelKey: ReturnType<typeof v2ProjectStatusLabelKey>;
  readonly color: string;
  readonly count: number;
  readonly cards: readonly Card[];
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  readonly moreError: string;
}

const NO_MORE: ColumnMore = { items: [], cursor: null, loading: false, error: '' };

// Projects kanban (task P7). Not drawn on the canvas: built from the design system and the
// Projects-list board (owner decision 2026-11-07). Ten columns = the pipeline 3 stages with their
// counts, cards newest first; Cancelled is not a column but a link to the list filtered by it.
// Data: `GET /v1/projects/board` (first 20 cards per column) and `GET /v1/projects?status=<column>`
// for "Show more". The status chips do not apply here; search and manager do.
// TODO(v2): dragging a card to another column opens Change status (P5); not built yet.
@Component({
  selector: 'app-v2-projects-kanban',
  imports: [RouterLink, TranslatePipe, V2Button, V2CodeChip, V2StatePanel],
  templateUrl: './v2-projects-kanban.html',
  styleUrl: './v2-projects-kanban.scss',
})
export class V2ProjectsKanban {
  private readonly projects = inject(V2ProjectsService);
  private readonly i18n = inject(I18nService);

  readonly filters = input.required<V2ProjectsFilterSet>();
  readonly now = input.required<Date>();
  /** The viewer asked to see the cancelled projects (the page switches to the filtered list). */
  readonly showCancelled = output<void>();

  private readonly apiQuery = computed(() =>
    toV2ProjectsApiQuery({ ...this.filters(), statuses: [] }),
  );

  private readonly boardResource = resource({
    params: () => this.apiQuery(),
    loader: ({ params }) => this.projects.board({ ...params, limit: COLUMN_PAGE }),
  });

  private readonly more = linkedSignal<
    unknown,
    Readonly<Partial<Record<V2ProjectStatus, ColumnMore>>>
  >({ source: () => this.apiQuery(), computation: () => ({}) });

  protected readonly loading = computed(
    () => this.boardResource.isLoading() && !this.boardResource.hasValue(),
  );
  protected readonly failed = computed(() => this.boardResource.status() === 'error');
  protected readonly cancelledCount = computed(() =>
    this.boardResource.hasValue() ? this.boardResource.value().cancelledCount : 0,
  );
  protected readonly skeletonColumns = V2_PROJECT_STAGES;

  protected readonly columns = computed<readonly Column[]>(() => {
    if (!this.boardResource.hasValue()) return [];
    const board = this.boardResource.value();
    const locale = this.i18n.locale();
    const now = this.now();
    const t = (key: Parameters<I18nService['t']>[0]) => this.i18n.t(key);
    const more = this.more();
    return board.columns.map((column) => {
      const extra = more[column.status] ?? NO_MORE;
      const cursor = extra.cursor ?? column.nextCursor;
      return {
        status: column.status,
        labelKey: v2ProjectStatusLabelKey(column.status),
        color: V2_PROJECT_STATUS_COLOR[column.status],
        count: column.count,
        cards: [...column.items, ...extra.items].map((project) => ({
          ...toV2ProjectRow(project, now, locale, t),
          estimate: project.estimateTotals.map((total) => formatV2Money(total, locale)).join(' + '),
        })),
        hasMore: !!cursor,
        loadingMore: extra.loading,
        moreError: extra.error,
      };
    });
  });

  protected retry(): void {
    this.boardResource.reload();
  }

  /** Next page of one column; ignores a double click and drops the answer if the filters changed. */
  protected showMore(status: V2ProjectStatus): void {
    const column = this.boardResource.hasValue()
      ? this.boardResource.value().columns.find((item) => item.status === status)
      : undefined;
    const extra = this.more()[status] ?? NO_MORE;
    const cursor = extra.cursor ?? column?.nextCursor;
    if (extra.loading || !cursor) return;
    const query = this.apiQuery();
    this.patch(status, { ...extra, loading: true, error: '' });
    this.projects.list({ ...query, status: [status], limit: COLUMN_PAGE, cursor }).then(
      (page) => {
        if (query !== this.apiQuery()) return;
        this.patch(status, {
          items: [...extra.items, ...page.items],
          cursor: page.nextCursor ?? '',
          loading: false,
          error: '',
        });
      },
      (error: unknown) => {
        if (query !== this.apiQuery()) return;
        this.patch(status, {
          ...extra,
          loading: false,
          error: error instanceof Error ? this.i18n.localizeError(error.message) : '',
        });
      },
    );
  }

  private patch(status: V2ProjectStatus, value: ColumnMore): void {
    this.more.update((current) => ({ ...current, [status]: value }));
  }
}
