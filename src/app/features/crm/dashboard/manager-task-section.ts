import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { KolssApiClient, KolssApiError } from '@core/api/generated/kolss-api.client';
import type {
  DashboardTask,
  ManagerTaskSection as TaskSection,
  ManagerTaskStatus,
} from '@core/api/generated/kolss-api.types';
import { AuthService } from '@core/auth/auth.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { canManageTasks } from '@core/policy/task.policy';
import { officeDateKey } from '@services/appointments.service';
import { UiButton } from '@ui/button/ui-button';
import { UiIcon } from '@ui/icon/ui-icon';

@Component({
  selector: 'app-manager-task-section',
  imports: [UiButton, UiIcon],
  templateUrl: './manager-task-section.html',
  styleUrl: './manager-task-section.scss',
})
export class ManagerTaskSection {
  readonly managerId = input.required<string>();
  readonly officeId = input<string | null>(null);
  readonly section = input.required<TaskSection>();
  readonly revision = input(0);
  readonly changed = output<void>();
  readonly taskOpened = output<DashboardTask>();
  private readonly api = inject(KolssApiClient);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly tasks = signal<readonly DashboardTask[]>([]);
  protected readonly cursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly mutationError = signal('');
  protected readonly pendingId = signal<string | null>(null);
  protected readonly canManage = computed(() => canManageTasks(this.auth.me()?.permissions));
  protected readonly history = computed(
    () => this.section() === 'done' || this.section() === 'canceled',
  );
  protected readonly title = computed(() =>
    this.i18n.t(`dashboard.board.${this.section()}` as MessageKey),
  );
  private generation = 0;
  private scope = '';
  private retryAppend = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.generation++);
    effect(() => {
      const scope = `${this.officeId()}:${this.managerId()}:${this.section()}`;
      this.revision();
      untracked(() => {
        if (scope !== this.scope) {
          this.scope = scope;
          this.tasks.set([]);
          this.cursor.set(null);
          this.mutationError.set('');
        }
        void this.load(false);
      });
    });
  }

  protected async load(append = false): Promise<void> {
    if (append && (this.loading() || !this.cursor())) return;
    this.retryAppend = append;
    const generation = ++this.generation;
    const query = {
      officeId: this.officeId(),
      managerId: this.managerId(),
      section: this.section(),
    };
    const target = append ? 0 : this.tasks().length;
    let cursor = append ? this.cursor() : null;
    let items: readonly DashboardTask[] = append ? this.tasks() : [];
    this.loading.set(true);
    this.loadError.set('');
    try {
      do {
        const response = await this.api.managerTasks({ ...query, cursor });
        if (generation !== this.generation) return;
        const seen = new Set(items.map((task) => task.id));
        items = [...items, ...response.items.filter((task) => !seen.has(task.id))];
        cursor = response.nextCursor;
      } while (!append && cursor && items.length < target);
      this.tasks.set(items);
      this.cursor.set(cursor);
    } catch {
      if (generation === this.generation)
        this.loadError.set(this.i18n.t('dashboard.board.loadFailed'));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  protected retry(): void {
    void this.load(this.retryAppend);
  }

  protected async changeStatus(task: DashboardTask, status: ManagerTaskStatus): Promise<void> {
    if (this.pendingId() || !this.canManage() || task.source !== 'manual' || task.version === null)
      return;
    this.pendingId.set(task.id);
    this.mutationError.set('');
    try {
      await this.api.updateManagerTask(task.sourceId, task.version, status);
      this.changed.emit();
    } catch (error) {
      const stale =
        error instanceof KolssApiError && (error.status === 409 || error.status === 412);
      this.mutationError.set(
        this.i18n.t(stale ? 'dashboard.board.stale' : 'dashboard.board.saveFailed'),
      );
      if (stale) this.changed.emit();
    } finally {
      this.pendingId.set(null);
    }
  }

  protected officeName(task: DashboardTask): string {
    return this.i18n.locale() === 'uk' ? task.office.nameUk : task.office.namePl;
  }

  protected kindLabel(task: DashboardTask): string {
    switch (task.kind) {
      case 'manual':
        return this.i18n.t('dashboard.board.importantLabel');
      case 'showroom':
        return this.i18n.t('calendar.kind.showroom');
      case 'measurement':
        return this.i18n.t('calendar.kind.measurement');
      case 'office_work':
        return this.i18n.t('calendar.kind.officeWork');
      case 'comment':
        return this.i18n.t('lead.comment');
      case 'callback':
        return this.i18n.callStatusLabel('callback_requested');
      default:
        return this.i18n.clientStatusLabel(task.kind);
    }
  }

  protected dueTone(task: DashboardTask): 'overdue' | 'today' | '' {
    if (!task.localDate || this.history()) return '';
    const today = officeDateKey(new Date(), task.office.timezoneName);
    return task.localDate < today ? 'overdue' : task.localDate === today ? 'today' : '';
  }

  protected dueLabel(task: DashboardTask): string {
    if (!task.dueAt) return '';
    return new Intl.DateTimeFormat(this.i18n.locale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: task.office.timezoneName,
      ...(task.source === 'manual' ? {} : ({ hour: '2-digit', minute: '2-digit' } as const)),
    }).format(new Date(task.dueAt));
  }
}
