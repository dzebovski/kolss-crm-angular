import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { canViewAllTasks } from '@core/policy/task.policy';
import { SessionService } from '@core/session/session.service';
import { formatV2CardDate } from '@domain/v2/date-format';
import { v2CanEditTaskList } from '@domain/v2/task-form';
import {
  v2DayProgress,
  v2GroupTasks,
  v2AssignableEmployees,
  type V2TaskGroup,
} from '@domain/v2/task-view';
import type { V2Task, V2TaskKind, V2TaskList } from '@domain/v2/task.types';
import { UsersService } from '@services/users.service';
import { V2TasksService, type V2TaskFeedFilters } from '@services/v2/v2-tasks.service';
import { V2_NOW } from '../core/v2-clock';
import { V2DialogService } from '../ui/dialog/v2-dialog.service';
import { V2Button } from '../ui/v2-button';
import { V2EmptyState } from '../ui/v2-empty-state';
import type { V2SelectOption } from '../ui/v2-select';
import { V2NewListDialog, type V2NewListData } from './v2-new-list-dialog';
import { V2NewTaskDialog, type V2NewTaskData } from './v2-new-task-dialog';
import { V2TaskLeadPopups } from './v2-task-lead-popups';
import { V2TaskListHead } from './v2-task-list-head';
import { V2TaskPanel } from './v2-task-panel';
import { V2TaskGroupCard } from './v2-task-group';
import {
  V2_TASK_CHIP_KINDS,
  V2_TASK_GROUP_LABEL,
  V2_TASK_VIEW_LABEL,
  V2_TASK_VIEW_SUB,
} from './v2-task-labels';
import { v2LongDate } from './v2-task-presenter';
import {
  parseV2TasksQuery,
  toV2TasksQueryParams,
  v2VisibleKinds,
  type V2TasksQuery,
} from './v2-tasks-query';
import { V2TasksNewMenu } from './v2-tasks-new-menu';
import { V2TasksSidebar } from './v2-tasks-sidebar';
import { V2TasksToolbar } from './v2-tasks-toolbar';

/** URL update delay after typing in search, as the leads list; also debounces the fetch. */
const SEARCH_URL_DELAY_MS = 300;

interface GroupCard {
  readonly group: V2TaskGroup;
  readonly label: string;
  readonly emptyText: string;
  readonly danger: boolean;
  readonly collapsible: boolean;
  readonly canAdd: boolean;
}

// Tasks (`/v2/tasks`, boards Tasks-my-day … Tasks-list-expo): views and task lists on the left,
// the grouped feed on the right. Data comes from `GET /v1/tasks` (+ `/counts`, `/task-lists`)
// through `V2TasksService`; state lives in the query params (see `V2TasksQuery`).
@Component({
  selector: 'app-v2-tasks-page',
  imports: [
    TranslatePipe,
    V2Button,
    V2EmptyState,
    V2TaskGroupCard,
    V2TaskListHead,
    V2TaskPanel,
    V2TasksNewMenu,
    V2TasksSidebar,
    V2TasksToolbar,
  ],
  templateUrl: './v2-tasks-page.html',
  styleUrl: './v2-tasks-page.scss',
})
export class V2TasksPage {
  private readonly tasks = inject(V2TasksService);
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(V2_NOW);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly leadPopups = inject(V2TaskLeadPopups);
  private readonly dialogs = inject(V2DialogService);

  // Query params, bound by `withComponentInputBinding()`.
  readonly view = input<string>();
  readonly list = input<string>();
  readonly q = input<string>();
  readonly hide = input<string>();
  readonly who = input<string>();
  readonly task = input<string>();

  protected readonly canViewAll = computed(() => canViewAllTasks(this.auth.profile()?.role));
  protected readonly query = computed(() =>
    parseV2TasksQuery(
      {
        view: this.view(),
        list: this.list(),
        q: this.q(),
        hide: this.hide(),
        who: this.who(),
        task: this.task(),
      },
      this.canViewAll(),
    ),
  );

  /** What the search field shows: follows the URL except for our own delayed write. */
  protected readonly searchText = linkedSignal<string, string>({
    source: () => this.query().q,
    computation: (q, previous) => (previous && q === this.writtenQ ? previous.value : q),
  });
  private writtenQ: string | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly filters = computed<V2TaskFeedFilters>(() => {
    const query = this.query();
    return {
      view: query.view,
      listId: query.listId,
      officeId: this.session.selectedOfficeId(),
      assigneeId: query.assigneeId || null,
      kinds: v2VisibleKinds(query.hidden, V2_TASK_CHIP_KINDS),
      search: query.q,
    };
  });

  private readonly feedResource = resource({
    params: () => this.filters(),
    loader: ({ params }) => this.tasks.feed(params),
  });
  private readonly countsResource = resource({
    params: () => this.session.selectedOfficeId(),
    loader: ({ params }) => this.tasks.counts(params),
  });
  private readonly listsResource = resource({ loader: () => this.tasks.lists() });
  private readonly employeesResource = resource({ loader: () => this.users.listManagers() });

  /** Taken when the feed arrives, so day labels stay stable between reloads. */
  protected readonly now = computed(() => {
    this.feedResource.status();
    return this.clock();
  });

  protected readonly loading = computed(
    () => this.feedResource.isLoading() && !this.feedResource.hasValue(),
  );
  protected readonly loadError = computed(() => {
    if (this.feedResource.status() !== 'error') return '';
    const error = this.feedResource.error();
    return error instanceof Error
      ? this.i18n.localizeError(error.message)
      : this.i18n.t('error.actionFailed');
  });
  protected readonly items = computed<readonly V2Task[]>(() =>
    this.feedResource.hasValue() ? this.feedResource.value().items : [],
  );
  protected readonly truncated = computed(
    () => this.feedResource.hasValue() && this.feedResource.value().truncated,
  );

  protected readonly counts = computed(() =>
    this.countsResource.hasValue() ? this.countsResource.value() : null,
  );
  protected readonly lists = computed(() =>
    this.listsResource.hasValue() ? this.listsResource.value() : [],
  );
  protected readonly listsFailed = computed(() => this.listsResource.status() === 'error');
  protected readonly openList = computed(() => {
    const id = this.query().listId;
    return id ? (this.lists().find((list) => list.id === id) ?? null) : null;
  });
  protected readonly canEditList = computed(() => {
    const list = this.openList();
    return list
      ? v2CanEditTaskList(list, {
          id: this.auth.sessionContext()?.user.id ?? null,
          isSuperAdmin: this.session.officeContext()?.isSuperAdmin ?? false,
        })
      : false;
  });
  /** A list id that no list has, once the lists arrived. */
  protected readonly listMissing = computed(
    () => this.query().listId !== null && this.listsResource.hasValue() && this.openList() === null,
  );

  protected readonly isListView = computed(() => this.query().view === 'list');
  protected readonly title = computed(() => {
    const view = this.query().view;
    return view === 'list' ? '' : this.i18n.t(V2_TASK_VIEW_LABEL[view]);
  });
  protected readonly subtitle = computed(() => {
    const view = this.query().view;
    if (view === 'list') return '';
    return this.i18n.t(V2_TASK_VIEW_SUB[view], {
      date: v2LongDate(this.now(), this.i18n.locale()),
    });
  });
  protected readonly progress = computed(() =>
    this.query().view === 'my_day' && this.feedResource.hasValue()
      ? v2DayProgress(this.items(), this.now())
      : null,
  );
  protected readonly assigneeOptions = computed<readonly V2SelectOption[] | null>(() => {
    if (this.query().view !== 'all') return null;
    const people = v2AssignableEmployees(
      this.employeesResource.hasValue() ? this.employeesResource.value() : [],
      this.session.selectedOfficeId(),
    );
    return [
      { value: '', label: this.i18n.t('v2.tasks.everyone') },
      ...people.map((person) => ({ value: person.id, label: person.displayName })),
    ];
  });

  protected readonly cards = computed<readonly GroupCard[]>(() => {
    const view = this.query().view;
    const now = this.now();
    const locale = this.i18n.locale();
    const t = (key: MessageKey, params?: Record<string, string | number>): string =>
      this.i18n.t(key, params);
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return v2GroupTasks(view, this.items(), now).map((group) => {
      let label = t(V2_TASK_GROUP_LABEL[group.key], {
        date: formatV2CardDate(group.key === 'tomorrow' ? tomorrow : now, now, locale),
      });
      if (group.key === 'done' && view === 'done') label = t('v2.tasks.group.doneRecently');
      return {
        group,
        label,
        emptyText: t(
          group.key === 'overdue' ? 'v2.tasks.group.overdueEmpty' : 'v2.tasks.group.empty',
        ),
        danger: group.key === 'overdue' && group.items.length > 0,
        collapsible: view === 'list' && group.key === 'done',
        canAdd: view === 'list' && group.key === 'todo',
      };
    });
  });

  protected readonly selectedId = computed(() => this.query().taskId);
  /** The open task, while it is still in the feed (a closed call-back or a deleted task is not). */
  protected readonly selectedTask = computed(() => {
    const id = this.selectedId();
    return id ? (this.items().find((task) => task.id === id) ?? null) : null;
  });
  protected readonly employees = computed(() =>
    this.employeesResource.hasValue() ? this.employeesResource.value() : [],
  );
  protected readonly actionError = signal('');
  private readonly busy = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  protected retry(): void {
    this.reloadAll();
  }

  protected reloadAll(): void {
    this.feedResource.reload();
    this.countsResource.reload();
    this.listsResource.reload();
  }

  protected select(task: V2Task): void {
    this.navigate({ taskId: task.id });
  }

  protected onSearch(text: string): void {
    this.searchText.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.navigate({ q: text }), SEARCH_URL_DELAY_MS);
  }

  protected onAssignee(assigneeId: string): void {
    this.navigate({ assigneeId });
  }

  protected toggleKind(kind: V2TaskKind): void {
    const hidden = this.query().hidden;
    this.navigate({
      hidden: hidden.includes(kind) ? hidden.filter((value) => value !== kind) : [...hidden, kind],
    });
  }

  /** New task; from "Add task to this list" it opens linked to that list. */
  protected async openNewTask(listId: string | null = null): Promise<void> {
    const ref = this.dialogs.open<string, V2NewTaskData>(V2NewTaskDialog, {
      employees: this.employees(),
      lists: this.lists(),
      listId,
    });
    const createdId = await firstValueFrom(ref.closed);
    if (!createdId) return;
    this.reloadAll();
    this.navigate({ taskId: createdId });
  }

  /** New task list, or Edit list (the list's owner and super admins). */
  protected async openListDialog(list: V2TaskList | null = null): Promise<void> {
    const ref = this.dialogs.open<V2TaskList, V2NewListData>(V2NewListDialog, {
      employees: this.employees(),
      list,
    });
    const saved = await firstValueFrom(ref.closed);
    if (!saved) return;
    this.listsResource.reload();
    // A new list opens at once; an edited one stays where it is.
    if (!list) this.navigate({ view: 'list', listId: saved.id, taskId: null, assigneeId: '' });
    else this.feedResource.reload();
  }

  protected closePanel(): void {
    this.navigate({ taskId: null });
  }

  /** "Plan next step" of a lead with nothing planned opens Add comment on that lead. */
  protected async planNextStep(task: V2Task): Promise<void> {
    if (!task.link || this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    try {
      if (await this.leadPopups.openComment(task.link.id)) this.reloadAll();
    } catch (error) {
      this.actionError.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.busy.set(false);
    }
  }

  /** The row circle: a manual task flips between To do and Done; a comment reminder is cleared. */
  protected async toggle(task: V2Task): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    try {
      if (task.automatic && task.link) {
        await this.tasks.clearReminder(task.link.id, 'comment');
      } else {
        await this.tasks.setStatus(task, task.status === 'done' ? 'todo' : 'done');
      }
      this.reloadAll();
    } catch (error) {
      this.actionError.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.busy.set(false);
    }
  }

  private navigate(patch: Partial<V2TasksQuery>): void {
    const queryParams = toV2TasksQueryParams({ ...this.query(), q: this.searchText(), ...patch });
    this.writtenQ = queryParams['q'] ?? '';
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }
}
