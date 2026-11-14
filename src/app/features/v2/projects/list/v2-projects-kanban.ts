import { CdkDrag, CdkDropList, CdkDropListGroup, type CdkDragDrop } from '@angular/cdk/drag-drop';
import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2Money } from '@domain/v2/project-money';
import {
  V2_PROJECT_STAGES,
  V2_PROJECT_STATUS_COLOR,
  v2IsChangeableProjectStatus,
  v2ProjectStatusLabelKey,
} from '@domain/v2/project-status';
import type { V2Project, V2ProjectListItem, V2ProjectStatus } from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { V2DialogService } from '../../ui/dialog/v2-dialog.service';
import { V2Button } from '../../ui/v2-button';
import { V2CodeChip } from '../../ui/v2-code-chip';
import { V2StatePanel } from '../../ui/v2-state-panel';
import {
  V2ProjectStatusDialog,
  type V2ProjectStatusData,
} from '../dialogs/v2-project-status-dialog';
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
  /** Cards can be dropped on every stage column. */
  readonly droppable: boolean;
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
// Dragging a card to another column opens Change status with that stage picked (Q-P17); the card
// moves only after the popup saves (the board reloads). Intro / Main contract columns take no
// drops: those stages come from Add contract. Without a mouse, Change status on the card does it.
@Component({
  selector: 'app-v2-projects-kanban',
  imports: [
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    RouterLink,
    TranslatePipe,
    V2Button,
    V2CodeChip,
    V2StatePanel,
  ],
  templateUrl: './v2-projects-kanban.html',
  styleUrl: './v2-projects-kanban.scss',
})
export class V2ProjectsKanban {
  private readonly projects = inject(V2ProjectsService);
  private readonly i18n = inject(I18nService);
  private readonly dialogs = inject(V2DialogService);

  readonly filters = input.required<V2ProjectsFilterSet>();
  readonly now = input.required<Date>();
  /** The viewer asked to see the cancelled projects (the page switches to the filtered list). */
  readonly showCancelled = output<void>();
  readonly showCompleted = output<void>();

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
  protected readonly completedCount = computed(() =>
    this.boardResource.hasValue() ? this.boardResource.value().completedCount : 0,
  );
  protected readonly cancelledCount = computed(() =>
    this.boardResource.hasValue() ? this.boardResource.value().cancelledCount : 0,
  );
  protected readonly skeletonColumns = V2_PROJECT_STAGES;
  /** The card whose project is loading after a drop; a second drop waits for it. */
  protected readonly moving = signal<string | null>(null);
  protected readonly moveError = signal('');
  protected readonly dragging = signal(false);
  /** CDK asks before a card enters a column. */
  protected readonly canEnter = (_drag: CdkDrag, drop: CdkDropList<V2ProjectStatus>): boolean =>
    v2IsChangeableProjectStatus(drop.data);

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
        droppable: v2IsChangeableProjectStatus(column.status),
        count: column.count,
        cards: [...column.items, ...extra.items].map((project) => ({
          ...toV2ProjectRow(project, now, locale, t),
          estimate: project.estimate ? formatV2Money(project.estimate, locale) : '',
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

  /** A card left its column: open Change status on the full project with the target picked. */
  protected async drop(event: CdkDragDrop<V2ProjectStatus, V2ProjectStatus, V2ProjectListItem>) {
    const item = event.item.data;
    const status = event.container.data;
    if (event.previousContainer === event.container || this.moving()) return;
    this.moving.set(item.id);
    this.moveError.set('');
    let project: V2Project;
    try {
      project = await this.projects.get(item.id);
    } catch (error) {
      this.moveError.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
      return;
    } finally {
      this.moving.set(null);
    }
    if (!project.canEdit || project.status === 'cancelled' || project.status === 'completed') {
      this.moveError.set(this.i18n.t('v2.projects.kanban.moveLocked', { code: project.code }));
      return;
    }
    const ref = this.dialogs.open<V2Project | null, V2ProjectStatusData>(V2ProjectStatusDialog, {
      project,
      status,
    });
    if (await firstValueFrom(ref.closed)) {
      this.more.set({});
      this.boardResource.reload();
    }
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
