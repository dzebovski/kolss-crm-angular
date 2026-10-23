import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, maxLength } from '@angular/forms/signals';

import { AuthService } from '@core/auth/auth.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import {
  v2CreateListRequest,
  v2ListDraft,
  v2UpdateListRequest,
  v2ValidateNewList,
  type V2NewListDraft,
  type V2NewListField,
} from '@domain/v2/task-form';
import { v2AssignableEmployees } from '@domain/v2/task-view';
import type { V2TaskList } from '@domain/v2/task.types';
import type { CrmEmployee } from '@services/users.service';
import { V2TasksService } from '@services/v2/v2-tasks.service';
import { V2DialogShell } from '../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../ui/dialog/v2-form-field';

export interface V2NewListData {
  readonly employees: readonly CrmEmployee[];
  /** Edit list reuses this popup for the list's owner (Q-T1); absent = New task list. */
  readonly list: V2TaskList | null;
}

const ERROR_KEY = {
  nameRequired: 'v2.tasks.newList.errName',
  ownerRequired: 'v2.tasks.newList.errOwner',
} as const;

// New task list (board Tasks-new-list, 560px): name, what it is about, when (free text), owner, and
// the note on what happens next. Edit list opens the same popup with the list's values. The colour
// is assigned by the API and the members are the assignees of the list's tasks (Q-T1). Closes with
// the saved list.
@Component({
  selector: 'app-v2-new-list-dialog',
  imports: [FormField, TranslatePipe, V2DialogShell, V2FormField],
  templateUrl: './v2-new-list-dialog.html',
  styleUrl: './v2-new-list-dialog.scss',
})
export class V2NewListDialog {
  private readonly dialogRef = inject<DialogRef<V2TaskList>>(DialogRef);
  private readonly data = inject<V2NewListData>(DIALOG_DATA);
  private readonly service = inject(V2TasksService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  protected readonly editing = this.data.list !== null;
  private readonly initial: V2NewListDraft = this.data.list
    ? v2ListDraft(this.data.list)
    : {
        name: '',
        description: '',
        datesText: '',
        ownerId: this.auth.sessionContext()?.user.id ?? '',
      };

  protected readonly model = signal<V2NewListDraft>(this.initial);
  protected readonly fields = form(this.model, (path) => {
    maxLength(path.name, 200);
    maxLength(path.description, 2000);
    maxLength(path.datesText, 100);
  });
  protected readonly owners = computed(() => {
    const people = v2AssignableEmployees(this.data.employees, null);
    const current = this.data.list?.owner;
    return current && !people.some((person) => person.id === current.id)
      ? [{ id: current.id, displayName: current.name }, ...people]
      : people;
  });

  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly touched = signal(false);

  protected readonly errors = computed(() => v2ValidateNewList(this.model()));
  protected readonly errorCount = computed(() => Object.keys(this.errors()).length);
  protected readonly hasUnsavedInput = computed(() => {
    const value = this.model();
    return (
      value.name !== this.initial.name ||
      value.description !== this.initial.description ||
      value.datesText !== this.initial.datesText ||
      value.ownerId !== this.initial.ownerId
    );
  });

  protected fieldError(field: V2NewListField): string {
    const error = this.touched() ? this.errors()[field] : undefined;
    return error ? this.i18n.t(ERROR_KEY[error]) : '';
  }

  protected async save(): Promise<void> {
    if (this.saving() || this.errorCount() > 0) return;
    const draft = this.model();
    this.error.set('');
    this.saving.set(true);
    try {
      const list = this.data.list;
      if (list) {
        const request = v2UpdateListRequest(list, draft);
        // Nothing changed: close without a request.
        this.dialogRef.close(request ? await this.service.updateList(list, request) : list);
      } else {
        this.dialogRef.close(await this.service.createList(v2CreateListRequest(draft)));
      }
    } catch (error) {
      this.error.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
