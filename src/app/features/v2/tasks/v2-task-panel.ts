import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { isTaskAdmin } from '@core/policy/task.policy';
import {
  v2AssignableEmployees,
  v2TaskCanDelete,
  v2TaskClearsReminder,
  v2TaskDue,
  v2TaskHasCallResult,
} from '@domain/v2/task-view';
import type { V2Task, V2TaskStatus } from '@domain/v2/task.types';
import type { CrmEmployee } from '@services/users.service';
import { V2TasksService } from '@services/v2/v2-tasks.service';
import { V2DialogService } from '../ui/dialog/v2-dialog.service';
import { V2Button } from '../ui/v2-button';
import { V2CodeChip } from '../ui/v2-code-chip';
import { V2Select, type V2SelectOption } from '../ui/v2-select';
import { V2TaskDeleteDialog } from './v2-task-delete-dialog';
import { V2TaskKindBadge } from './v2-task-kind-badge';
import { V2_TASK_KIND_LABEL, V2_TASK_STATUS_LABEL } from './v2-task-labels';
import { V2TaskLeadPopups } from './v2-task-lead-popups';
import { v2TaskDueView, v2TaskOrigin, v2TaskTitle } from './v2-task-presenter';

const STATUSES: readonly V2TaskStatus[] = ['todo', 'progress', 'done'];

// Task detail panel (Tasks-my-day-panel.dc.html, 420px): source chip, title, status control,
// assignee, due date and time, link, phone, note, the kind's actions and the origin line.
// Manual tasks edit in place (T1 rules, Q-T2: title and note for who `canEdit`); automatic items
// are read-only and close through their lead (Call-back: the call-result popups). Delete is the
// soft `status: canceled` after a confirm (Q-T3).
@Component({
  selector: 'app-v2-task-panel',
  imports: [RouterLink, TranslatePipe, V2Button, V2CodeChip, V2Select, V2TaskKindBadge],
  templateUrl: './v2-task-panel.html',
  styleUrl: './v2-task-panel.scss',
})
export class V2TaskPanel {
  private readonly tasks = inject(V2TasksService);
  private readonly popups = inject(V2TaskLeadPopups);
  private readonly dialogs = inject(V2DialogService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly task = input.required<V2Task>();
  readonly now = input.required<Date>();
  readonly employees = input<readonly CrmEmployee[]>([]);

  readonly closed = output<void>();
  /** A change was saved: the page reloads the feed, counts and lists. */
  readonly changed = output<void>();

  protected readonly pending = signal(false);
  protected readonly error = signal('');
  protected readonly editing = signal(false);
  protected readonly titleDraft = signal('');
  protected readonly noteDraft = signal('');

  // The controls show what the viewer picked at once and snap back when the save fails.
  protected readonly statusValue = linkedSignal(() => this.task().status);
  protected readonly assigneeValue = linkedSignal(() => this.task().assignee?.id ?? '');
  protected readonly dateValue = linkedSignal(() => this.task().dueDate ?? '');
  protected readonly timeValue = linkedSignal(() => this.task().dueTime ?? '');

  protected readonly title = computed(() => {
    this.i18n.locale();
    return v2TaskTitle(this.task(), (key, params) => this.i18n.t(key, params));
  });
  protected readonly kindLabel = computed(() => V2_TASK_KIND_LABEL[this.task().kind]);
  protected readonly readOnly = computed(() => this.task().automatic || !this.task().canManage);
  protected readonly canEditText = computed(() => !this.task().automatic && this.task().canEdit);
  protected readonly canDelete = computed(() =>
    v2TaskCanDelete(this.task(), {
      id: this.auth.sessionContext()?.user.id ?? null,
      isAdmin: isTaskAdmin(this.auth.profile()?.role),
    }),
  );
  protected readonly statusOptions = computed(() =>
    STATUSES.map((value) => ({
      value,
      label:
        value === 'done' && this.task().kind === 'visit'
          ? 'v2.tasks.status.visited'
          : V2_TASK_STATUS_LABEL[value],
    })),
  );
  protected readonly assigneeOptions = computed<readonly V2SelectOption[]>(() => {
    const task = this.task();
    const people = v2AssignableEmployees(this.employees(), task.officeId).map((person) => ({
      value: person.id,
      label: person.displayName,
    }));
    const current = task.assignee;
    if (!current) {
      return [{ value: '', label: this.i18n.t('v2.tasks.panel.unassigned') }, ...people];
    }
    return people.some((person) => person.value === current.id)
      ? people
      : [{ value: current.id, label: current.name }, ...people];
  });
  protected readonly dueNote = computed(() => {
    this.i18n.locale();
    const view = v2TaskDueView(
      v2TaskDue(this.task(), this.now()),
      this.now(),
      this.i18n.locale(),
      (key, params) => this.i18n.t(key, params),
    );
    if (!view.danger) return '';
    return this.task().status !== 'done' && v2TaskDue(this.task(), this.now()).kind === 'overdue'
      ? view.primary
      : view.secondary;
  });
  protected readonly origin = computed(() => {
    this.i18n.locale();
    return v2TaskOrigin(this.task(), (key, params) => this.i18n.t(key, params));
  });
  protected readonly linkLabel = computed(() => {
    const type = this.task().link?.type;
    return type ? (`v2.tasks.link.${type}` as const) : null;
  });
  protected readonly showCallResult = computed(() => v2TaskHasCallResult(this.task()));
  protected readonly showClearReminder = computed(() => v2TaskClearsReminder(this.task()));
  protected readonly showNoNextStep = computed(
    () => this.task().kind === 'nonext' && this.task().link?.type === 'lead',
  );

  protected setStatus(value: V2TaskStatus): void {
    this.statusValue.set(value);
    if (value === this.task().status) return;
    void this.run(() => this.tasks.setStatus(this.task(), value));
  }

  protected setAssignee(id: string): void {
    this.assigneeValue.set(id);
    if (!id || id === this.task().assignee?.id) return;
    void this.run(() => this.tasks.setAssignee(this.task(), id));
  }

  protected setDate(date: string): void {
    this.dateValue.set(date);
    if (!date) this.timeValue.set('');
    if (date === (this.task().dueDate ?? '')) return;
    void this.run(() => this.tasks.setDue(this.task(), date || null, this.timeValue() || null));
  }

  protected setTime(time: string): void {
    this.timeValue.set(time);
    if (!this.dateValue() || time === (this.task().dueTime ?? '')) return;
    void this.run(() => this.tasks.setDue(this.task(), this.dateValue(), time || null));
  }

  protected startEdit(): void {
    this.titleDraft.set(this.task().title);
    this.noteDraft.set(this.task().note);
    this.error.set('');
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.error.set('');
  }

  protected async saveEdit(): Promise<void> {
    if (!this.titleDraft().trim()) {
      this.error.set(this.i18n.t('v2.tasks.err.title'));
      return;
    }
    const saved = await this.run(() =>
      this.tasks.setText(this.task(), this.titleDraft(), this.noteDraft()),
    );
    if (saved) this.editing.set(false);
  }

  protected async remove(): Promise<void> {
    const confirmed = await firstValueFrom(this.dialogs.open<boolean>(V2TaskDeleteDialog).closed);
    if (confirmed !== true) return;
    if (await this.run(() => this.tasks.remove(this.task()))) this.closed.emit();
  }

  protected callResult(kind: 'success' | 'later' | 'noanswer'): void {
    void this.openLeadPopup((leadId) => this.popups.openStatus(leadId, kind));
  }

  protected planNextStep(): void {
    void this.openLeadPopup((leadId) => this.popups.openComment(leadId));
  }

  protected markLost(): void {
    void this.openLeadPopup((leadId) => this.popups.openStatus(leadId, 'lost'));
  }

  protected clearReminder(): void {
    const link = this.task().link;
    if (!link) return;
    void this.run(() => this.tasks.clearReminder(link.id, 'comment'));
  }

  private async openLeadPopup(open: (leadId: string) => Promise<boolean>): Promise<void> {
    const link = this.task().link;
    if (!link || this.pending()) return;
    this.error.set('');
    this.pending.set(true);
    try {
      if (await open(link.id)) this.changed.emit();
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.pending.set(false);
    }
  }

  /** Runs a save with the pending flag; on failure shows the message and resets the controls. */
  private async run(save: () => Promise<void>): Promise<boolean> {
    if (this.pending()) return false;
    this.error.set('');
    this.pending.set(true);
    try {
      await save();
      this.changed.emit();
      return true;
    } catch (error) {
      this.error.set(this.message(error));
      this.resetControls();
      return false;
    } finally {
      this.pending.set(false);
    }
  }

  private resetControls(): void {
    const task = this.task();
    this.statusValue.set(task.status);
    this.assigneeValue.set(task.assignee?.id ?? '');
    this.dateValue.set(task.dueDate ?? '');
    this.timeValue.set(task.dueTime ?? '');
  }

  private message(error: unknown): string {
    return this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed');
  }
}
