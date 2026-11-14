import { Component, computed, inject, input, output, signal } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2CardDate, formatV2Time } from '@domain/v2/date-format';
import { v2FormatFileSize } from '@domain/v2/lead-documents';
import type { V2ProjectTimelineItem } from '@domain/v2/project-timeline';
import type { V2ProjectMeeting } from '@domain/v2/project-meetings';
import type { V2ProjectDocument } from '@domain/v2/project.types';
import type { V2Task } from '@domain/v2/task.types';
import { V2Button } from '../../ui/v2-button';
import { V2ProjectActivities, type V2MeetingOutcome } from './v2-project-activities';

type V2ProjectTab = 'documents' | 'statuses';

/** Generated documents of P14, shown disabled until then. */
const GENERATED = [
  'v2.projectCard.generate.estimate',
  'v2.projectCard.generate.intro',
  'v2.projectCard.generate.main',
] as const satisfies readonly MessageKey[];

// Tabs of Project card v4 (owner decisions 2026-11-14): Documents (upload several files, list,
// download, delete — P11; generation comes with P14) and Statuses & tasks (comments, the project's
// tasks and meetings — P12). Comments are read here, the timeline only notes them.
@Component({
  selector: 'app-v2-project-tabs',
  imports: [TranslatePipe, V2Button, V2ProjectActivities],
  templateUrl: './v2-project-tabs.html',
  styleUrl: './v2-project-tabs.scss',
})
export class V2ProjectTabs {
  private readonly i18n = inject(I18nService);

  readonly documents = input.required<readonly V2ProjectDocument[]>();
  /** Comment events of the timeline, newest first. */
  readonly comments = input.required<readonly V2ProjectTimelineItem[]>();
  readonly commentsLoading = input(false);
  readonly now = input.required<Date>();
  readonly canComment = input(false);
  readonly canUpload = input(false);
  /** Whether the current user may delete this document (uploader, manager, admins). */
  readonly canDelete = input<(document: V2ProjectDocument) => boolean>(() => false);
  /** The upload in progress, if any. */
  readonly uploading = input<{ readonly name: string; readonly percent: number } | null>(null);
  /** A failed upload, delete or download. */
  readonly error = input('');
  readonly tasks = input<readonly V2Task[]>([]);
  readonly meetings = input<readonly V2ProjectMeeting[]>([]);
  readonly activitiesLoading = input(false);
  readonly activitiesFailed = input(false);
  readonly canPlan = input(false);
  readonly activityBusy = input<string | null>(null);
  readonly activityError = input('');
  readonly retryActivities = output<void>();
  readonly addTask = output<void>();
  readonly toggleTask = output<V2Task>();
  readonly addMeeting = output<void>();
  readonly reschedule = output<V2ProjectMeeting>();
  readonly meetingOutcome = output<V2MeetingOutcome>();
  /** Open tasks and scheduled meetings: the count on the Statuses & tasks tab. */
  protected readonly planned = computed(
    () =>
      this.tasks().filter((task) => task.status !== 'done').length +
      this.meetings().filter((meeting) => meeting.status === 'scheduled').length,
  );
  readonly openDocument = output<string>();
  readonly upload = output<readonly File[]>();
  readonly deleteDocument = output<V2ProjectDocument>();
  readonly addComment = output<void>();

  protected readonly tab = signal<V2ProjectTab>('documents');
  protected readonly tabs: readonly { id: V2ProjectTab; labelKey: MessageKey }[] = [
    { id: 'documents', labelKey: 'v2.projectCard.tab.documents' },
    { id: 'statuses', labelKey: 'v2.projectCard.tab.statuses' },
  ];
  protected readonly generated = GENERATED;

  protected readonly documentRows = computed(() => {
    const locale = this.i18n.locale();
    const canDelete = this.canDelete();
    return this.documents().map((document) => ({
      document,
      id: document.id,
      deletable: canDelete(document),
      name: document.fileName,
      meta: [
        v2FormatFileSize(document.sizeBytes),
        document.uploadedBy?.name,
        formatV2CardDate(document.createdAt, this.now(), locale),
      ]
        .filter(Boolean)
        .join(' · '),
    }));
  });

  protected readonly commentRows = computed(() => {
    const locale = this.i18n.locale();
    return this.comments().map((comment) => ({
      id: comment.id,
      author: comment.actorName ?? this.i18n.t('v2.card.system'),
      at: `${formatV2CardDate(comment.at, this.now(), locale)}, ${formatV2Time(comment.at)}`,
      text: comment.text ?? '',
    }));
  });

  protected choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length) this.upload.emit(files);
  }

  /** Arrow keys move between the two tabs (WAI-ARIA tabs pattern). */
  protected onKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next: V2ProjectTab = this.tab() === 'documents' ? 'statuses' : 'documents';
    this.tab.set(next);
    const host = (event.currentTarget as HTMLElement).parentElement;
    host?.querySelector<HTMLElement>(`#v2-project-tab-${next}`)?.focus();
  }
}
