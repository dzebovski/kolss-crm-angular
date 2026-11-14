import { Component, computed, inject, input, output, signal } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2CardDate, formatV2Time } from '@domain/v2/date-format';
import { v2FormatFileSize } from '@domain/v2/lead-documents';
import type { V2ProjectTimelineItem } from '@domain/v2/project-timeline';
import type { V2ProjectDocument } from '@domain/v2/project.types';
import { V2Button } from '../../ui/v2-button';

type V2ProjectTab = 'documents' | 'statuses';

/** Generated documents of P14, shown disabled until then. */
const GENERATED = [
  'v2.projectCard.generate.estimate',
  'v2.projectCard.generate.intro',
  'v2.projectCard.generate.main',
] as const satisfies readonly MessageKey[];

// Tabs of Project card v4 (owner decisions 2026-11-14): Documents (list + download; upload and
// delete come with P11, generation with P14) and Statuses & tasks (comments; tasks and meetings
// come with P12). Comments are read here, the timeline only notes them.
@Component({
  selector: 'app-v2-project-tabs',
  imports: [TranslatePipe, V2Button],
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
  /** A failed download. */
  readonly error = input('');
  readonly openDocument = output<string>();
  readonly addComment = output<void>();

  protected readonly tab = signal<V2ProjectTab>('documents');
  protected readonly tabs: readonly { id: V2ProjectTab; labelKey: MessageKey }[] = [
    { id: 'documents', labelKey: 'v2.projectCard.tab.documents' },
    { id: 'statuses', labelKey: 'v2.projectCard.tab.statuses' },
  ];
  protected readonly generated = GENERATED;

  protected readonly documentRows = computed(() => {
    const locale = this.i18n.locale();
    return this.documents().map((document) => ({
      id: document.id,
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
