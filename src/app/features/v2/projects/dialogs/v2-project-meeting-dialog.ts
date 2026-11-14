import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import { AuthService } from '@core/auth/auth.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { v2LocalDay } from '@domain/v2/project-forms';
import {
  V2_PROJECT_MEETING_DURATIONS,
  V2_PROJECT_MEETING_KINDS,
  v2MeetingDraftErrors,
  v2MeetingDuration,
  v2MeetingLocalParts,
  v2MeetingStartsAtLocal,
  type V2MeetingDraft,
  type V2MeetingDraftError,
  type V2ProjectMeeting,
  type V2ProjectMeetingKind,
} from '@domain/v2/project-meetings';
import type { V2Project } from '@domain/v2/project.types';
import type { CrmEmployee } from '@services/users.service';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { v2LiveNow } from '../../core/v2-clock';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FieldGroup } from '../../ui/dialog/v2-field-group';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2ChipSelect, type V2ChipOption } from '../../ui/v2-chip-select';
import { V2Select } from '../../ui/v2-select';
import { V2ProjectNotice } from './v2-project-notice';

export interface V2ProjectMeetingData {
  readonly project: V2Project;
  readonly employees: readonly CrmEmployee[];
  /** Set to reschedule this meeting; kind stays. */
  readonly meeting?: V2ProjectMeeting;
}

interface MeetingModel {
  kind: string;
  date: string;
  time: string;
  duration: string;
  managerId: string;
  comment: string;
}

export const V2_MEETING_KIND_LABEL: Record<V2ProjectMeetingKind, MessageKey> = {
  showroom: 'v2.projectMeetings.kind.showroom',
  measurement: 'v2.projectMeetings.kind.measurement',
};

const ERROR_KEY: Record<V2MeetingDraftError, MessageKey> = {
  date: 'v2.projectMeetings.err.date',
  datePassed: 'v2.projectMeetings.err.datePassed',
  time: 'v2.projectMeetings.err.time',
  manager: 'v2.projectMeetings.err.manager',
  comment: 'v2.projectMeetings.err.comment',
};

// Add / reschedule a project meeting (P12; no board, design-system popup): kind (showroom meeting
// or measurement, add only), date, time, duration, responsible manager and a comment. A project
// meeting never changes the lead's statuses. Closes with true after a save.
@Component({
  selector: 'app-v2-project-meeting-dialog',
  imports: [
    FormField,
    TranslatePipe,
    V2ChipSelect,
    V2DialogShell,
    V2FieldGroup,
    V2FormField,
    V2ProjectNotice,
    V2Select,
  ],
  template: `
    @let errors = shown();
    <app-v2-dialog
      [title]="(editing ? 'v2.projectMeetings.reschedule' : 'v2.projectMeetings.add') | translate"
      [subtitle]="subtitle"
      width="form"
      [hint]="'v2.projectMeetings.hint' | translate"
      [cancelLabel]="'v2.projectPopup.cancel' | translate"
      [saveLabel]="(editing ? 'v2.projectPopup.saveChanges' : 'v2.projectMeetings.add') | translate"
      [saveDisabled]="saving()"
      [invalid]="invalid()"
      [errorCount]="errorCount()"
      [hasUnsavedInput]="hasUnsavedInput()"
      (save)="save()"
      (invalidAttempt)="touched.set(true)"
    >
      @if (error(); as message) {
        <app-v2-project-notice tone="danger">{{ message }}</app-v2-project-notice>
      }
      @if (!editing) {
        <app-v2-field-group [label]="'v2.projectMeetings.kind' | translate" [required]="true">
          <app-v2-chip-select
            [ariaLabel]="'v2.projectMeetings.kind' | translate"
            [options]="kinds"
            [formField]="fields.kind"
          />
        </app-v2-field-group>
      }
      <div class="v2-meeting-popup__row">
        <app-v2-form-field
          [label]="'v2.projectCard.payment.date' | translate"
          [required]="true"
          [error]="errors.date ?? ''"
        >
          <input type="date" [formField]="fields.date" />
        </app-v2-form-field>
        <app-v2-form-field
          [label]="'v2.projectPopup.status.time' | translate"
          [required]="true"
          [error]="errors.time ?? ''"
        >
          <input type="time" step="900" [formField]="fields.time" />
        </app-v2-form-field>
        <app-v2-form-field [label]="'v2.projectMeetings.duration' | translate">
          <app-v2-select
            [ariaLabel]="'v2.projectMeetings.duration' | translate"
            [options]="durations"
            [formField]="fields.duration"
          />
        </app-v2-form-field>
      </div>
      <app-v2-form-field
        [label]="'v2.projectMeetings.manager' | translate"
        [required]="true"
        [error]="errors.manager ?? ''"
      >
        <select [formField]="fields.managerId">
          <option value="">{{ 'v2.tasks.newTask.choosePerson' | translate }}</option>
          @for (person of managers(); track person.id) {
            <option [value]="person.id">{{ person.displayName }}</option>
          }
        </select>
      </app-v2-form-field>
      <app-v2-form-field [label]="'v2.timeline.comment' | translate" [error]="errors.comment ?? ''">
        <textarea rows="3" [formField]="fields.comment"></textarea>
      </app-v2-form-field>
    </app-v2-dialog>
  `,
  styles: `
    .v2-meeting-popup__row {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr) minmax(0, 2fr);
      gap: var(--v2-space-3);
    }

    @media (max-width: 560px) {
      .v2-meeting-popup__row {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class V2ProjectMeetingDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly projects = inject(V2ProjectsService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject<V2ProjectMeetingData>(DIALOG_DATA);
  private readonly liveNow = v2LiveNow();

  private readonly project = this.data.project;
  private readonly meeting = this.data.meeting;
  protected readonly editing = !!this.meeting;
  protected readonly subtitle = `${this.project.code} · ${this.project.clientName}`;

  protected readonly kinds: readonly V2ChipOption[] = V2_PROJECT_MEETING_KINDS.map((kind) => ({
    id: kind,
    label: this.i18n.t(V2_MEETING_KIND_LABEL[kind]),
  }));
  /** The API books only active members of the project's office (no super-admin exception). */
  protected readonly managers = computed(() =>
    this.data.employees.filter(
      (person) => person.status === 'active' && person.officeUuids.includes(this.project.officeId),
    ),
  );

  private readonly initial: MeetingModel = (() => {
    const meeting = this.meeting;
    if (meeting) {
      const local = v2MeetingLocalParts(meeting.startsAt, meeting.timezone);
      return {
        kind: meeting.kind,
        date: local.date,
        time: local.time,
        duration: String(v2MeetingDuration(meeting)),
        managerId: meeting.manager?.id ?? '',
        comment: meeting.comment ?? '',
      };
    }
    const me = this.auth.profile()?.id ?? '';
    const preferred = [this.project.manager?.id, me].find(
      (id) => !!id && this.managers().some((person) => person.id === id),
    );
    return {
      kind: this.project.status === 'measurement_design' ? 'measurement' : 'showroom',
      date: '',
      time: '',
      duration: '60',
      managerId: preferred ?? '',
      comment: '',
    };
  })();

  protected readonly durations = (() => {
    const values = new Set([...V2_PROJECT_MEETING_DURATIONS, Number(this.initial.duration)]);
    return [...values]
      .sort((a, b) => a - b)
      .map((minutes) => ({
        value: String(minutes),
        label: this.i18n.t('v2.projectMeetings.minutes', { count: minutes }),
      }));
  })();

  protected readonly model = signal<MeetingModel>({ ...this.initial });
  protected readonly fields = form(this.model);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly touched = signal(false);
  private readonly idempotencyKey = crypto.randomUUID();

  private readonly draft = computed<V2MeetingDraft>(() => {
    const value = this.model();
    return {
      kind: value.kind === 'measurement' ? 'measurement' : 'showroom',
      date: value.date,
      time: value.time,
      duration: Number(value.duration),
      managerId: value.managerId,
      comment: value.comment,
    };
  });
  private readonly errors = computed(() => {
    const errors = v2MeetingDraftErrors(this.draft(), v2LocalDay(this.liveNow()));
    return Object.fromEntries(
      Object.entries(errors).map(([field, error]) => [field, this.i18n.t(ERROR_KEY[error])]),
    ) as Partial<Record<'date' | 'time' | 'manager' | 'comment', string>>;
  });
  protected readonly invalid = computed(() => Object.keys(this.errors()).length > 0);
  protected readonly errorCount = computed(() => Object.keys(this.errors()).length);
  protected readonly shown = computed(() => (this.touched() ? this.errors() : {}));
  protected readonly hasUnsavedInput = computed(
    () => JSON.stringify(this.model()) !== JSON.stringify(this.initial),
  );

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    const meeting = this.meeting;
    if (meeting && !this.hasUnsavedInput()) {
      this.dialogRef.close(false);
      return;
    }
    const draft = this.draft();
    this.saving.set(true);
    this.error.set('');
    try {
      if (meeting) {
        const value = this.model();
        const moved = value.date !== this.initial.date || value.time !== this.initial.time;
        await this.projects.updateMeeting(meeting, {
          ...(moved && { startsAtLocal: v2MeetingStartsAtLocal(draft) }),
          ...(value.duration !== this.initial.duration && { durationMinutes: draft.duration }),
          ...(value.managerId !== this.initial.managerId && {
            responsibleManagerId: draft.managerId,
          }),
          ...(value.comment !== this.initial.comment && { comment: draft.comment.trim() }),
        });
      } else {
        await this.projects.createMeeting(this.project.id, draft, this.idempotencyKey);
      }
      this.dialogRef.close(true);
    } catch (error) {
      this.error.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
