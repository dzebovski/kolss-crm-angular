import { Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import { I18nService } from '@core/i18n/i18n.service';
import type { QuestionLanguage } from '@domain/lead.types';
import type { OfficeId } from '@domain/office.types';
import type { CrmEmployee } from '@services/users.service';
import { UiButton } from '@ui/button/ui-button';
import { UiMultiSelect, type UiMultiSelectOption } from '@ui/form/ui-multi-select';
import { UiSelect, type UiSelectOption } from '@ui/form/ui-select';
import { UiTextarea } from '@ui/form/ui-textarea';

const LANGUAGE_OPTIONS: readonly UiSelectOption[] = [
  { value: 'UK', label: 'Українська' },
  { value: 'PL', label: 'Polski' },
  { value: 'EN', label: 'English' },
];

const DIALOG_STYLES = `
  :host { display: block; }
  .question-dialog { width: min(38rem, calc(100vw - 2rem)); padding: 1.5rem; display: grid; gap: 1.1rem; }
  .question-dialog__heading { display: grid; gap: .35rem; }
  .question-dialog h2, .question-dialog p { margin: 0; }
  .question-dialog h2 { font-family: var(--ui-font-display), sans-serif; font-size: 1.5rem; }
  .question-dialog__heading p { color: var(--ui-text-muted); font-size: .875rem; }
  .question-dialog__language-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
  .question-dialog__translation { display: grid; gap: .65rem; padding: .9rem; border-top: 1px solid var(--ui-border); background: color-mix(in srgb, var(--ui-action) 5%, var(--ui-surface-raised)); }
  .question-dialog__translation-header { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
  .question-dialog__translation-header strong { font-size: .8rem; }
  .question-dialog__translation p { color: var(--ui-text); white-space: pre-wrap; }
  .question-dialog__error { margin: 0; color: var(--ui-danger); font-size: .8rem; }
  .question-dialog__actions { display: flex; justify-content: flex-end; gap: .75rem; }
  @media (max-width: 34rem) { .question-dialog__language-grid { grid-template-columns: 1fr; } }
`;

interface QuestionFormModel {
  readonly text: string;
  readonly assigneeIds: readonly string[];
  readonly sourceLanguage: QuestionLanguage;
  readonly targetLanguage: QuestionLanguage;
}

export interface LeadQuestionDialogData {
  readonly employees: readonly CrmEmployee[];
  readonly officeCode: OfficeId;
  readonly initialText?: string;
  readonly initialAssigneeIds?: readonly string[];
  readonly initialTranslations?: Readonly<Partial<Record<QuestionLanguage, string>>>;
  readonly edit?: boolean;
}

export interface LeadQuestionDialogResult {
  readonly text: string;
  readonly assigneeIds: readonly string[];
  readonly translations: Readonly<Partial<Record<QuestionLanguage, string>>>;
}

@Component({
  selector: 'app-lead-question-dialog',
  imports: [FormField, UiButton, UiMultiSelect, UiSelect, UiTextarea],
  template: `
    <form class="question-dialog" (submit)="save($event)">
      <header class="question-dialog__heading">
        <h2 id="lead-question-dialog-title">
          {{ i18n.t(data.edit ? 'leadQuestion.editTitle' : 'leadQuestion.title') }}
        </h2>
        <p>{{ i18n.t('leadQuestion.hint') }}</p>
      </header>

      <app-ui-textarea
        [label]="i18n.t('leadQuestion.textLabel')"
        [placeholder]="i18n.t('leadQuestion.textPlaceholder')"
        [rows]="5"
        [formField]="questionForm.text"
        [error]="textError()"
      />
      <app-ui-multi-select
        [label]="i18n.t('leadQuestion.assignLabel')"
        [placeholder]="i18n.t('common.unassigned')"
        [options]="assigneeOptions"
        [formField]="questionForm.assigneeIds"
      />

      <div class="question-dialog__language-grid">
        <app-ui-select
          [label]="i18n.t('leadQuestion.sourceLanguage')"
          [options]="languageOptions"
          [formField]="questionForm.sourceLanguage"
        />
        <app-ui-select
          [label]="i18n.t('leadQuestion.targetLanguage')"
          [options]="languageOptions"
          [formField]="questionForm.targetLanguage"
        />
      </div>
      <app-ui-button
        variant="ghost"
        [loading]="translating()"
        [disabled]="translating() || !model().text.trim()"
        (pressed)="translate()"
      >
        {{ i18n.t('leadQuestion.translate') }}
      </app-ui-button>
      @if (translationError()) {
        <p class="question-dialog__error" role="alert">{{ translationError() }}</p>
      }
      @for (translation of translationEntries(); track translation.language) {
        <section class="question-dialog__translation" [attr.aria-label]="translation.language">
          <div class="question-dialog__translation-header">
            <strong>{{
              i18n.t('leadQuestion.translation', { language: translation.language })
            }}</strong>
          </div>
          <p>{{ translation.text }}</p>
        </section>
      }

      <footer class="question-dialog__actions">
        <app-ui-button
          variant="ghost"
          [disabled]="questionForm().submitting()"
          (pressed)="cancel()"
        >
          {{ i18n.t('common.cancel') }}
        </app-ui-button>
        <app-ui-button type="submit" [loading]="questionForm().submitting()">
          {{ i18n.t(data.edit ? 'common.save' : 'leadQuestion.create') }}
        </app-ui-button>
      </footer>
    </form>
  `,
  styles: [DIALOG_STYLES],
})
export class LeadQuestionDialog {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(KolssApiClient);
  protected readonly data = inject<LeadQuestionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<LeadQuestionDialog, LeadQuestionDialogResult>);
  protected readonly languageOptions = LANGUAGE_OPTIONS;
  protected readonly assigneeOptions: readonly UiMultiSelectOption[] = this.data.employees
    .filter(
      (employee) =>
        employee.status === 'active' &&
        employee.role === 'office_member' &&
        employee.officeIds.includes(this.data.officeCode),
    )
    .map((employee) => ({ value: employee.id, label: employee.displayName }));
  protected readonly model = signal<QuestionFormModel>({
    text: this.data.initialText ?? '',
    assigneeIds: this.data.initialAssigneeIds ?? [],
    sourceLanguage: 'UK',
    targetLanguage: 'PL',
  });
  protected readonly translations = signal<Partial<Record<QuestionLanguage, string>>>(
    this.data.initialTranslations ?? {},
  );
  private readonly translationSourceText = signal(this.data.initialText?.trim() ?? '');
  protected readonly translating = signal(false);
  protected readonly translationError = signal('');
  protected readonly questionForm = form(this.model, (path) => {
    required(path.text, { message: this.i18n.t('leadQuestion.textRequired') });
    validate(path.text, ({ value }) =>
      value().trim()
        ? undefined
        : { kind: 'required', message: this.i18n.t('leadQuestion.textRequired') },
    );
  });

  protected textError(): string {
    const state = this.questionForm.text();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  }

  protected translationEntries(): readonly {
    readonly language: QuestionLanguage;
    readonly text: string;
  }[] {
    return (['UK', 'PL', 'EN'] as const).flatMap((language) => {
      const text = this.translations()[language];
      return text ? [{ language, text }] : [];
    });
  }

  protected async translate(): Promise<void> {
    const value = this.model();
    if (!value.text.trim() || value.sourceLanguage === value.targetLanguage || this.translating()) {
      if (value.sourceLanguage === value.targetLanguage) {
        this.translationError.set(this.i18n.t('leadQuestion.sameLanguage'));
      }
      return;
    }
    if (this.translationSourceText() !== value.text.trim()) {
      this.translations.set({});
      this.translationSourceText.set(value.text.trim());
    }
    this.translating.set(true);
    this.translationError.set('');
    try {
      const response = await this.api.translateText({
        text: value.text.trim(),
        sourceLanguage: value.sourceLanguage,
        targetLanguage: value.targetLanguage,
      });
      this.translations.update((translations) => ({
        ...translations,
        [value.targetLanguage]: response.translation,
      }));
    } catch {
      this.translationError.set(this.i18n.t('leadQuestion.translationFailed'));
    } finally {
      this.translating.set(false);
    }
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.questionForm, async () => {
      const value = this.model();
      this.dialogRef.close({
        text: value.text.trim(),
        assigneeIds: [...new Set(value.assigneeIds)],
        translations: this.translationSourceText() === value.text.trim() ? this.translations() : {},
      });
    });
  }

  protected cancel(): void {
    if (!this.questionForm().submitting()) this.dialogRef.close();
  }
}

export interface LeadQuestionAnswerDialogData {
  readonly initialText?: string;
  readonly initialTranslations?: Readonly<Partial<Record<QuestionLanguage, string>>>;
  readonly edit?: boolean;
}

export interface LeadQuestionAnswerDialogResult {
  readonly text: string;
  readonly targetLanguage: QuestionLanguage;
  readonly translations: Readonly<Partial<Record<QuestionLanguage, string>>>;
}

@Component({
  selector: 'app-lead-question-answer-dialog',
  imports: [FormField, UiButton, UiSelect, UiTextarea],
  template: `
    <form class="question-dialog" (submit)="save($event)">
      <header class="question-dialog__heading">
        <h2 id="lead-question-answer-dialog-title">
          {{ i18n.t(data.edit ? 'leadQuestion.editAnswerTitle' : 'leadQuestion.answerTitle') }}
        </h2>
        <p>{{ i18n.t('leadQuestion.answerHint') }}</p>
      </header>
      <app-ui-textarea
        [label]="i18n.t('leadQuestion.answerTextLabel')"
        [rows]="5"
        [formField]="answerForm.text"
        [error]="textError()"
      />
      <app-ui-select
        [label]="i18n.t('leadQuestion.targetLanguage')"
        [options]="languageOptions"
        [formField]="answerForm.targetLanguage"
      />
      <app-ui-button
        variant="ghost"
        [loading]="translating()"
        [disabled]="translating() || !model().text.trim()"
        (pressed)="translate()"
        >{{ i18n.t('leadQuestion.translate') }}</app-ui-button
      >
      @if (translationError()) {
        <p class="question-dialog__error" role="alert">{{ translationError() }}</p>
      }
      @for (translation of translationEntries(); track translation.language) {
        <section class="question-dialog__translation" [attr.aria-label]="translation.language">
          <strong>{{
            i18n.t('leadQuestion.translation', { language: translation.language })
          }}</strong>
          <p>{{ translation.text }}</p>
        </section>
      }
      <footer class="question-dialog__actions">
        <app-ui-button variant="ghost" [disabled]="answerForm().submitting()" (pressed)="cancel()">
          {{ i18n.t('common.cancel') }}
        </app-ui-button>
        <app-ui-button type="submit" [loading]="answerForm().submitting()">
          {{ i18n.t(data.edit ? 'common.save' : 'leadQuestion.answer') }}
        </app-ui-button>
      </footer>
    </form>
  `,
  styles: [DIALOG_STYLES],
})
export class LeadQuestionAnswerDialog {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(KolssApiClient);
  protected readonly data = inject<LeadQuestionAnswerDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<LeadQuestionAnswerDialog, LeadQuestionAnswerDialogResult>,
  );
  protected readonly languageOptions = LANGUAGE_OPTIONS;
  protected readonly model = signal({
    text: this.data.initialText ?? '',
    targetLanguage: 'EN' as QuestionLanguage,
  });
  protected readonly translations = signal<Partial<Record<QuestionLanguage, string>>>(
    this.data.initialTranslations ?? {},
  );
  protected readonly translating = signal(false);
  protected readonly translationError = signal('');
  protected readonly answerForm = form(this.model, (path) => {
    required(path.text, { message: this.i18n.t('leadQuestion.answerRequired') });
    validate(path.text, ({ value }) =>
      value().trim()
        ? undefined
        : { kind: 'required', message: this.i18n.t('leadQuestion.answerRequired') },
    );
  });

  protected textError(): string {
    const state = this.answerForm.text();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  }

  protected translationEntries(): readonly {
    readonly language: QuestionLanguage;
    readonly text: string;
  }[] {
    return (['UK', 'PL', 'EN'] as const).flatMap((language) => {
      const text = this.translations()[language];
      return text ? [{ language, text }] : [];
    });
  }

  protected async translate(): Promise<void> {
    if (this.translating() || !this.model().text.trim()) return;
    this.translating.set(true);
    this.translationError.set('');
    try {
      const response = await this.api.translateText({
        text: this.model().text.trim(),
        targetLanguage: this.model().targetLanguage,
      });
      this.translations.update((translations) => ({
        ...translations,
        [this.model().targetLanguage]: response.translation,
      }));
    } catch {
      this.translationError.set(this.i18n.t('leadQuestion.translationFailed'));
    } finally {
      this.translating.set(false);
    }
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.answerForm, async () => {
      this.dialogRef.close({
        text: this.model().text.trim(),
        targetLanguage: this.model().targetLanguage,
        translations: this.translations(),
      });
    });
  }

  protected cancel(): void {
    if (!this.answerForm().submitting()) this.dialogRef.close();
  }
}
