import { Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2CardDate } from '@domain/v2/date-format';
import { v2ProjectDay } from '@domain/v2/project-card';
import {
  V2_PROJECT_STAGES,
  V2_PROJECT_STATUS_COLOR,
  v2ProjectNextEventLabelKey,
  v2ProjectStageState,
  v2ProjectStatusLabelKey,
  type V2ProjectStageState,
} from '@domain/v2/project-status';
import type { V2Project } from '@domain/v2/project.types';
import { V2Button } from '../../ui/v2-button';
import { V2ProjectStatusPill } from '../../ui/v2-project-status-pill';

interface StageStep {
  readonly stage: (typeof V2_PROJECT_STAGES)[number];
  readonly number: number;
  readonly state: V2ProjectStageState;
  readonly color: string;
}

// Status bar of the Project card (Project-card board, pipeline 3): status pill with its next
// event, the 10-step stage tracker and Change status. Presentational: the page decides whether
// the button is enabled (`v2ProjectActions`) and opens the popup (P5).
@Component({
  selector: 'app-v2-project-stage-bar',
  imports: [TranslatePipe, V2Button, V2ProjectStatusPill],
  templateUrl: './v2-project-stage-bar.html',
  styleUrl: './v2-project-stage-bar.scss',
})
export class V2ProjectStageBar {
  private readonly i18n = inject(I18nService);

  readonly project = input.required<V2Project>();
  readonly now = input.required<Date>();
  readonly canChange = input(false);
  /** Tooltip of the locked button (the read-only hint); empty while the user can act. */
  readonly lockHint = input('');
  readonly changeStatus = output<void>();

  protected readonly steps = computed<readonly StageStep[]>(() =>
    V2_PROJECT_STAGES.map((stage, index) => ({
      stage,
      number: index + 1,
      state: v2ProjectStageState(this.project().status, stage),
      color: V2_PROJECT_STATUS_COLOR[stage],
    })),
  );
  protected readonly stageLabel = v2ProjectStatusLabelKey;

  /** "Estimate deadline: Tue 29 Sep, 17:00"; null when the status has no planned event. */
  protected readonly nextEvent = computed(() => {
    const { status, schedule } = this.project();
    const labelKey = v2ProjectNextEventLabelKey(status);
    if (!labelKey || !schedule) return null;
    const day = formatV2CardDate(v2ProjectDay(schedule.date), this.now(), this.i18n.locale());
    return { labelKey, date: schedule.time ? `${day}, ${schedule.time}` : day };
  });
}
