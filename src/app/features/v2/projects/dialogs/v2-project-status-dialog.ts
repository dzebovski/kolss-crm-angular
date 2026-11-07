import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2Money } from '@domain/v2/project-money';
import { v2IsPastDay, v2LocalDay } from '@domain/v2/project-forms';
import {
  V2_PROJECT_STAGES,
  v2IsChangeableProjectStatus,
  v2ProjectNextEventLabelKey,
  v2ProjectPrepaymentCheck,
  v2ProjectStatusLabelKey,
} from '@domain/v2/project-status';
import type { V2Project, V2ProjectStatus } from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { v2LiveNow } from '../../core/v2-clock';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FieldGroup } from '../../ui/dialog/v2-field-group';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2CardSelect, type V2CardSelectOption } from '../../ui/v2-card-select';
import { V2ProjectNotice } from './v2-project-notice';

export interface V2ProjectStatusData {
  readonly project: V2Project;
  /** Pre-picked status (kanban drag); the current one otherwise. */
  readonly status?: V2ProjectStatus;
}

interface StatusModel {
  status: string;
  eventDate: string;
  eventTime: string;
  comment: string;
}

// Change status (Project-status board, pipeline 3): the eight stages a user can pick (the
// contract stages are set by Add contract, Cancelled by Cancel project), the next event date and
// time, and a timeline comment. Picking the current stage edits its event. The 50% rule: moving
// to Production or later with less than 50% of the main contract paid is refused for a manager
// (409 `prepayment_required`) and needs a comment from an admin (400 on `comment`); the popup
// warns before saving and maps both answers. Closes with the updated project.
@Component({
  selector: 'app-v2-project-status-dialog',
  imports: [
    FormField,
    TranslatePipe,
    V2CardSelect,
    V2DialogShell,
    V2FieldGroup,
    V2FormField,
    V2ProjectNotice,
  ],
  templateUrl: './v2-project-status-dialog.html',
  styles: `
    .v2-status-popup__row {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: var(--v2-space-3);
    }
  `,
})
export class V2ProjectStatusDialog {
  private readonly dialogRef = inject<DialogRef<V2Project | null>>(DialogRef);
  private readonly projects = inject(V2ProjectsService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject<V2ProjectStatusData>(DIALOG_DATA);
  private readonly liveNow = v2LiveNow();

  protected readonly project = this.data.project;
  private readonly current = this.project.status;
  private readonly initial: StatusModel = (() => {
    const status = this.data.status ?? this.current;
    const own = status === this.current && this.project.schedule;
    return {
      status: v2IsChangeableProjectStatus(status) ? status : '',
      eventDate: own ? this.project.schedule!.date : '',
      eventTime: own ? (this.project.schedule!.time ?? '') : '',
      comment: '',
    };
  })();

  protected readonly model = signal<StatusModel>({ ...this.initial });
  protected readonly fields = form(this.model);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly touched = signal(false);
  /** The API asked for a comment (admin moving on with less than 50% paid). */
  private readonly commentRequired = signal(false);

  protected readonly subtitle = `${this.project.code} · ${this.project.clientName}`;

  protected readonly options = computed<readonly V2CardSelectOption[]>(() =>
    V2_PROJECT_STAGES.filter(v2IsChangeableProjectStatus).map((status) => ({
      id: status,
      label: this.i18n.t(v2ProjectStatusLabelKey(status)),
      sub:
        status === this.current
          ? this.i18n.t('v2.projectPopup.status.current')
          : status === 'completed'
            ? this.i18n.t('v2.projectPopup.status.closes')
            : this.i18n.t(v2ProjectNextEventLabelKey(status)!),
    })),
  );

  private readonly next = computed(() => (this.model().status || null) as V2ProjectStatus | null);
  /** Completed has no next event. */
  protected readonly eventLabelKey = computed(() => {
    const next = this.next();
    return next ? v2ProjectNextEventLabelKey(next) : null;
  });

  /** Less than 50% paid and the move crosses into Production. */
  protected readonly prepayment = computed(() => {
    const next = this.next();
    if (!next) return null;
    const main = this.project.contracts.main;
    const check = v2ProjectPrepaymentCheck({
      current: this.current,
      next,
      main,
      isAdmin: false,
    });
    if (check === 'ok') return null;
    const locale = this.i18n.locale();
    return main
      ? this.i18n.t('v2.projectPopup.status.prepayment', {
          percent: main.percentPaid,
          target: formatV2Money(main.target50 ?? main.total, locale),
        })
      : this.i18n.t('v2.projectPopup.status.prepaymentNoContract');
  });

  /** Completing with money still due is allowed, with a warning (Project-status board). */
  protected readonly unpaid = computed(() => {
    if (this.next() !== 'completed') return null;
    const main = this.project.contracts.main;
    if (!main) return this.i18n.t('v2.projectPopup.status.noContract');
    return main.remaining.amount > 0
      ? this.i18n.t('v2.projectPopup.status.unpaid', {
          amount: formatV2Money(main.remaining, this.i18n.locale()),
        })
      : null;
  });

  private readonly errors = computed(() => {
    const value = this.model();
    const today = v2LocalDay(this.liveNow());
    const errors: Partial<Record<'status' | 'eventDate' | 'eventTime' | 'comment', string>> = {};
    if (!value.status) errors.status = this.i18n.t('v2.projectPopup.status.pick');
    else if (
      value.status === this.current &&
      value.eventDate === this.initial.eventDate &&
      value.eventTime === this.initial.eventTime &&
      !value.comment.trim()
    ) {
      errors.status = this.i18n.t('v2.projectPopup.status.nothingChanged');
    }
    const dateChanged = value.eventDate !== this.initial.eventDate || value.status !== this.current;
    if (
      this.eventLabelKey() &&
      value.eventDate &&
      dateChanged &&
      v2IsPastDay(value.eventDate, today)
    )
      errors.eventDate = this.i18n.t('v2.projectPopup.datePast');
    if (value.eventTime && !value.eventDate)
      errors.eventDate = this.i18n.t('v2.projectPopup.status.dateForTime');
    if (this.commentRequired() && !value.comment.trim())
      errors.comment = this.i18n.t('v2.projectPopup.status.commentRequired');
    if (value.comment.trim().length > 1000)
      errors.comment = this.i18n.t('v2.projectCard.commentTooLong', { max: 1000 });
    return errors;
  });

  protected readonly invalid = computed(() => Object.keys(this.errors()).length > 0);
  protected readonly errorCount = computed(() => Object.keys(this.errors()).length);
  protected readonly shown = computed(() => (this.touched() ? this.errors() : {}));
  protected readonly hasUnsavedInput = computed(
    () => JSON.stringify(this.model()) !== JSON.stringify(this.initial),
  );

  protected readonly hint = computed(() => {
    const next = this.next();
    if (next && next !== this.current) {
      return this.i18n.t('v2.projectPopup.status.move', {
        from: this.i18n.t(v2ProjectStatusLabelKey(this.current)),
        to: this.i18n.t(v2ProjectStatusLabelKey(next)),
      });
    }
    return this.i18n.t('v2.projectPopup.timelineHint');
  });

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    const value = this.model();
    const withEvent = this.eventLabelKey() !== null;
    this.saving.set(true);
    this.error.set('');
    try {
      const project = await this.projects.changeStatus(this.project.id, {
        status: value.status as V2ProjectStatus,
        eventDate: withEvent && value.eventDate ? value.eventDate : null,
        eventTime: withEvent && value.eventDate && value.eventTime ? value.eventTime : null,
        comment: value.comment.trim() || null,
      });
      this.dialogRef.close(project);
    } catch (error) {
      if (error instanceof KolssApiError && error.code === 'prepayment_required') {
        this.error.set(this.i18n.t('v2.projectPopup.status.prepaymentBlocked'));
      } else if (
        error instanceof KolssApiError &&
        error.status === 400 &&
        this.prepayment() &&
        !value.comment.trim()
      ) {
        this.commentRequired.set(true);
        this.touched.set(true);
      } else {
        this.error.set(
          this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
        );
      }
    } finally {
      this.saving.set(false);
    }
  }
}
