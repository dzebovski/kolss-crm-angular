import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, maxLength } from '@angular/forms/signals';

import { AuthService } from '@core/auth/auth.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { SessionService } from '@core/session/session.service';
import { formatV2CardDate } from '@domain/v2/date-format';
import type { V2LeadListItem } from '@domain/v2/lead-view.types';
import {
  V2_NEW_TASK_LINK_KINDS,
  v2CreateTaskRequest,
  v2TaskDateChips,
  v2TaskLinkKindAvailable,
  v2TaskOfficeId,
  v2ValidateNewTask,
  type V2NewTaskDraft,
  type V2NewTaskError,
  type V2NewTaskField,
  type V2NewTaskLinkKind,
} from '@domain/v2/task-form';
import { v2AssignableEmployees, v2TaskIsoDate } from '@domain/v2/task-view';
import type { V2TaskList } from '@domain/v2/task.types';
import type { CrmEmployee } from '@services/users.service';
import { V2TasksService } from '@services/v2/v2-tasks.service';
import { v2LiveNow } from '../core/v2-clock';
import { V2DialogShell } from '../ui/dialog/v2-dialog-shell';
import { V2FieldGroup } from '../ui/dialog/v2-field-group';
import { V2FormField } from '../ui/dialog/v2-form-field';
import { V2_TASK_LINK_LABEL } from './v2-task-labels';
import { V2TaskLeadPicker } from './v2-task-lead-picker';

export interface V2NewTaskData {
  readonly employees: readonly CrmEmployee[];
  readonly lists: readonly V2TaskList[];
  /** "Add task to this list": the popup opens linked to it. */
  readonly listId: string | null;
}

const ERROR_KEY = {
  titleRequired: 'v2.tasks.err.title',
  assigneeRequired: 'v2.tasks.err.assignee',
  datePassed: 'v2.tasks.err.datePassed',
} as const;

// New task (boards Tasks-new-task / Tasks-new-task-errors, 600px): what to do, Linked to (Nothing ·
// Lead · Client · Project · Task list), assignee, due date with quick dates and an optional time,
// details. Client and project links stay off until the API accepts them (T1). Closes with the new
// task's feed id after a save.
@Component({
  selector: 'app-v2-new-task-dialog',
  imports: [FormField, TranslatePipe, V2DialogShell, V2FieldGroup, V2FormField, V2TaskLeadPicker],
  templateUrl: './v2-new-task-dialog.html',
  styleUrl: './v2-new-task-dialog.scss',
})
export class V2NewTaskDialog {
  private readonly dialogRef = inject<DialogRef<string>>(DialogRef);
  private readonly data = inject<V2NewTaskData>(DIALOG_DATA);
  private readonly service = inject(V2TasksService);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  protected readonly selectedOfficeId = this.session.selectedOfficeId;
  private readonly i18n = inject(I18nService);
  private readonly liveNow = v2LiveNow();

  private readonly me = this.auth.sessionContext()?.user.id ?? '';
  private readonly initial: V2NewTaskDraft = {
    title: '',
    linkKind: this.data.listId ? 'list' : 'none',
    linkId: this.data.listId ?? '',
    assigneeId: '',
    date: v2TaskIsoDate(this.liveNow()),
    time: '',
    note: '',
  };

  protected readonly model = signal<V2NewTaskDraft>(this.initial);
  protected readonly fields = form(this.model, (path) => {
    maxLength(path.title, 1000);
    maxLength(path.note, 5000);
  });
  protected readonly lists = this.data.lists;
  protected readonly linkKinds = V2_NEW_TASK_LINK_KINDS;
  protected readonly linkLabel = V2_TASK_LINK_LABEL;

  protected readonly pickedLead = signal<V2LeadListItem | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  /** Set once Save is pressed with a problem; fields only turn red after that. */
  protected readonly touched = signal(false);

  /** Office of the linked lead, else the one picked in the header. */
  private readonly contextOfficeId = computed(
    () => this.leadOfficeId() ?? this.session.selectedOfficeId(),
  );
  protected readonly assignees = computed(() =>
    v2AssignableEmployees(this.data.employees, this.contextOfficeId()),
  );
  protected readonly assigneeName = computed(
    () =>
      this.data.employees.find((person) => person.id === this.model().assigneeId)?.displayName ??
      '',
  );
  protected readonly errors = computed(() =>
    v2ValidateNewTask(this.model(), v2TaskIsoDate(this.liveNow())),
  );
  protected readonly errorCount = computed(() => Object.keys(this.errors()).length);
  protected readonly hasUnsavedInput = computed(() => {
    const value = this.model();
    return (
      value.title.trim() !== '' ||
      value.note.trim() !== '' ||
      value.time !== '' ||
      value.date !== this.initial.date ||
      value.linkId !== this.initial.linkId ||
      value.linkKind !== this.initial.linkKind ||
      value.assigneeId !== this.initial.assigneeId
    );
  });

  protected readonly dateChips = computed(() => {
    const now = this.liveNow();
    const locale = this.i18n.locale();
    const current = this.model().date;
    return v2TaskDateChips(now).map((chip) => {
      const date = v2TaskIsoDate(chip.date);
      const label =
        chip.key === 'today'
          ? this.i18n.t('v2.tasks.due.today')
          : chip.key === 'tomorrow'
            ? this.i18n.t('v2.tasks.due.tomorrow')
            : chip.key === 'inWeek'
              ? this.i18n.t('v2.form.date.chip.inWeek')
              : formatV2CardDate(chip.date, now, locale);
      return { key: chip.key, date, label, on: current === date };
    });
  });

  protected readonly hint = computed(() => {
    const id = this.model().assigneeId;
    if (!id || id === this.me) return this.i18n.t('v2.tasks.newTask.footMine');
    return this.i18n.t('v2.tasks.newTask.footOther', { name: this.assigneeName() });
  });
  protected readonly assigneeHint = computed(() => {
    const id = this.model().assigneeId;
    return id && id !== this.me
      ? this.i18n.t('v2.tasks.newTask.assigneeOther', { name: this.assigneeName() })
      : this.i18n.t('v2.tasks.newTask.assigneeMine');
  });

  private lastBody = '';
  private lastKey = '';

  constructor() {
    // Assigned to the creator by default (board), when they can be assigned in this context.
    const self = this.assignees().find((person) => person.id === this.me);
    if (self) this.model.update((value) => ({ ...value, assigneeId: self.id }));
  }

  private leadOfficeId(): string | null {
    const code = this.pickedLead()?.officeId;
    if (!code) return null;
    return (
      this.session.officeContext()?.filterOffices.find((office) => office.code === code)?.id ?? null
    );
  }

  protected fieldError(field: V2NewTaskField): string {
    if (!this.touched()) return '';
    const error: V2NewTaskError | undefined = this.errors()[field];
    if (!error) return '';
    if (error === 'linkRequired') {
      return this.i18n.t(
        this.model().linkKind === 'list' ? 'v2.tasks.err.linkList' : 'v2.tasks.err.linkLead',
      );
    }
    return this.i18n.t(ERROR_KEY[error]);
  }

  protected linkHint(): string {
    return this.i18n.t(`v2.tasks.linkHint.${this.model().linkKind}`);
  }

  protected kindAvailable(kind: V2NewTaskLinkKind): boolean {
    return v2TaskLinkKindAvailable(kind);
  }

  protected setLinkKind(kind: V2NewTaskLinkKind): void {
    if (!this.kindAvailable(kind) || kind === this.model().linkKind) return;
    this.pickedLead.set(null);
    this.model.update((value) => ({ ...value, linkKind: kind, linkId: '' }));
  }

  protected setLead(id: string, lead: V2LeadListItem | null): void {
    this.pickedLead.set(lead);
    this.model.update((value) => ({ ...value, linkId: id }));
  }

  protected setTime(time: string): void {
    this.model.update((value) => ({ ...value, time }));
  }

  protected setDate(date: string): void {
    this.model.update((value) => ({ ...value, date, time: date ? value.time : '' }));
  }

  protected async save(): Promise<void> {
    const draft = this.model();
    const officeId = v2TaskOfficeId({
      leadOfficeId: this.leadOfficeId(),
      selectedOfficeId: this.session.selectedOfficeId(),
      userOfficeIds: (this.session.officeContext()?.userOffices ?? []).map((office) => office.id),
      assigneeOfficeIds:
        this.data.employees.find((person) => person.id === draft.assigneeId)?.officeUuids ?? [],
    });
    if (this.saving() || this.errorCount() > 0) return;
    this.error.set('');
    if (!officeId) {
      this.error.set(this.i18n.t('v2.tasks.newTask.noOffice'));
      return;
    }
    const request = v2CreateTaskRequest(draft, officeId);
    // A retry of the same request reuses its key; a changed request gets a new one.
    const body = JSON.stringify(request);
    if (body !== this.lastBody) {
      this.lastBody = body;
      this.lastKey = crypto.randomUUID();
    }
    this.saving.set(true);
    try {
      const id = await this.service.create(request, this.lastKey);
      this.dialogRef.close(`manual:${id}`);
    } catch (error) {
      this.error.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
