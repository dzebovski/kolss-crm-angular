import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { disabled, form, FormField, required, validate } from '@angular/forms/signals';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import { I18nService } from '@core/i18n/i18n.service';
import type { Office } from '@models/database';
import { UiButton } from '@ui/button/ui-button';
import { UiSelect } from '@ui/form/ui-select';
import { UiTextField } from '@ui/form/ui-text-field';

@Component({
  selector: 'app-task-create-form',
  imports: [FormField, UiButton, UiSelect, UiTextField],
  template: `
    <form
      (submit)="save(); $event.preventDefault()"
      [attr.aria-label]="i18n.t('dashboard.board.add')"
    >
      <fieldset [disabled]="pending()">
        <app-ui-text-field
          [label]="i18n.t('dashboard.board.titleLabel')"
          [formField]="taskForm.title"
          [error]="invalid() ? i18n.t('dashboard.board.titleRequired') : ''"
        />
        <div class="form-meta">
          <app-ui-text-field
            type="date"
            [label]="i18n.t('dashboard.board.dueDate')"
            [formField]="taskForm.dueDate"
          />
          @if (offices().length > 1) {
            <app-ui-select
              [label]="i18n.t('dashboard.board.office')"
              [options]="officeOptions()"
              [formField]="taskForm.officeId"
            />
          }
        </div>
      </fieldset>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <div class="actions">
        <app-ui-button
          type="submit"
          size="small"
          [loading]="pending()"
          [disabled]="!offices().length"
        >
          {{ i18n.t('dashboard.board.create') }}
        </app-ui-button>
        <app-ui-button
          variant="ghost"
          size="small"
          [disabled]="pending()"
          (pressed)="closed.emit()"
        >
          {{ i18n.t('dashboard.board.closeForm') }}
        </app-ui-button>
      </div>
    </form>
  `,
  styles: `
    form {
      padding: var(--ui-space-4);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-subtle);
    }
    fieldset {
      margin: 0;
      padding: 0;
      border: 0;
      min-width: 0;
    }
    .form-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: var(--ui-space-3);
    }
    .actions {
      display: flex;
      gap: var(--ui-space-2);
    }
    .error {
      color: var(--ui-danger);
      font-size: 0.875rem;
    }
  `,
})
export class TaskCreateForm {
  readonly managerId = input.required<string>();
  readonly offices = input.required<readonly Office[]>();
  readonly created = output<void>();
  readonly closed = output<void>();
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(KolssApiClient);
  private readonly officeScope = computed(() =>
    this.offices()
      .map((office) => office.id)
      .join(','),
  );
  protected readonly model = linkedSignal(() => ({
    title: '',
    dueDate: '',
    officeId: this.officeScope().split(',')[0] ?? '',
  }));
  protected readonly taskForm = form(this.model, (path) => {
    disabled(path, () => this.pending());
    required(path.title);
    validate(path.title, ({ value }) =>
      value().trim().length > 0 && value().trim().length <= 1000 ? null : { kind: 'invalidTitle' },
    );
  });
  protected readonly pending = signal(false);
  protected readonly invalid = signal(false);
  protected readonly error = signal('');
  private attempt: { payload: string; key: string } | null = null;
  protected readonly officeOptions = computed(() =>
    this.offices().map((office) => ({
      value: office.id,
      label: this.i18n.locale() === 'uk' ? office.name_uk : office.name_pl,
    })),
  );

  protected async save(): Promise<void> {
    if (this.pending()) return;
    this.invalid.set(this.taskForm().invalid());
    if (this.invalid()) return;
    const model = this.model();
    const officeId = this.offices().length === 1 ? this.offices()[0]!.id : model.officeId;
    if (!this.offices().some((office) => office.id === officeId)) return;
    const body = {
      officeId,
      assigneeId: this.managerId(),
      title: model.title.trim(),
      dueDate: model.dueDate || null,
    };
    const payload = JSON.stringify(body);
    if (this.attempt?.payload !== payload) this.attempt = { payload, key: crypto.randomUUID() };
    this.pending.set(true);
    this.error.set('');
    try {
      await this.api.createManagerTask(body, this.attempt.key);
      this.attempt = null;
      this.created.emit();
    } catch {
      this.error.set(this.i18n.t('dashboard.board.saveFailed'));
    } finally {
      this.pending.set(false);
    }
  }
}
