import { Component, computed, inject, input, output } from '@angular/core';

import type { HrEmployeeDetail } from '@core/api/generated/kolss-api.types';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { V2Button } from '../../v2/ui/v2-button';
import { HrText } from '../hr-text';

// Schedule tab (HR-employee-schedule.dc.html): the current pattern and the history of patterns
// (never overwritten; a new one starts on its date).
@Component({
  selector: 'app-hr-employee-schedule',
  imports: [TranslatePipe, V2Button],
  template: `
    @if (current(); as c) {
      <section class="hr-card hr-sch">
        <div class="hr-sch__head">
          <div>
            <p class="hr-eyebrow">{{ 'hr.employee.schedule.current' | translate }}</p>
            <h2 class="hr-sch__title">{{ text.schedule(c) }}</h2>
          </div>
          <button type="button" appV2Button variant="primary" (click)="changeSchedule.emit()">
            {{ 'hr.employee.schedule.change' | translate }}
          </button>
        </div>
        <dl class="hr-kv">
          <dt>{{ 'hr.employee.schedule.type' | translate }}</dt>
          <dd>
            {{
              (c.kind === 'fixed' ? 'hr.pattern.fixedLong' : 'hr.schedule.kind.flexible')
                | translate
            }}
          </dd>
          <dt>{{ 'hr.employee.schedule.validFrom' | translate }}</dt>
          <dd>{{ text.fullDay(c.validFrom) }}</dd>
          <dt>{{ 'hr.employee.schedule.norm' | translate }}</dt>
          <dd class="hr-mono">
            {{
              'hr.employee.schedule.normValue'
                | translate
                  : {
                      days: text.plural('hr.n.days', c.daysPerWeek),
                      hours: text.number(c.daysPerWeek * c.hoursPerDay),
                    }
            }}
          </dd>
          <dt>{{ 'hr.employee.schedule.officeHours' | translate }}</dt>
          <dd>{{ text.officeHours(detail().office) }}</dd>
        </dl>
      </section>
    } @else {
      <section class="hr-card hr-sch">
        <div class="hr-sch__head">
          <h2 class="hr-sch__title">{{ 'hr.schedule.none' | translate }}</h2>
          <button type="button" appV2Button variant="primary" (click)="changeSchedule.emit()">
            {{ 'hr.employee.schedule.change' | translate }}
          </button>
        </div>
      </section>
    }

    <section
      class="hr-card"
      role="table"
      [attr.aria-label]="'hr.employee.schedule.history' | translate"
    >
      <div class="hr-tbl-title">
        <h2 class="hr-sch__h2">{{ 'hr.employee.schedule.history' | translate }}</h2>
        <p class="hr-caption">{{ 'hr.employee.schedule.historyHint' | translate }}</p>
      </div>
      <div class="hr-tr hr-th" role="row">
        <span role="columnheader">{{ 'hr.employee.schedule.validFrom' | translate }}</span>
        <span role="columnheader">{{ 'hr.employee.schedule.validTo' | translate }}</span>
        <span role="columnheader">{{ 'hr.employee.schedule.pattern' | translate }}</span>
        <span role="columnheader">{{ 'hr.employee.schedule.setBy' | translate }}</span>
        <span role="columnheader">{{ 'hr.employee.schedule.note' | translate }}</span>
      </div>
      @for (p of history(); track p.id) {
        <div class="hr-tr" role="row">
          <span role="cell">{{ text.date(p.validFrom) }}</span>
          <span role="cell">
            @if (p.validTo) {
              <span class="hr-caption">{{ text.date(p.validTo) }}</span>
            } @else {
              <span class="hr-tag">{{ 'hr.employee.schedule.currentTag' | translate }}</span>
            }
          </span>
          <span role="cell" class="hr-mono">{{ text.schedule(p) }}</span>
          <span role="cell">{{ p.createdByName ?? '–' }}</span>
          <span role="cell" class="hr-caption">{{ p.note ?? '' }}</span>
        </div>
      }
    </section>
  `,
  styleUrl: './hr-employee-tab.scss',
  host: {
    class: 'hr-tab-body',
    style: '--hr-cols: 140px 140px minmax(0, 1.4fr) 150px minmax(0, 1.4fr)',
  },
})
export class HrEmployeeSchedule {
  protected readonly text = inject(HrText);

  readonly detail = input.required<HrEmployeeDetail>();
  readonly changeSchedule = output<void>();

  protected readonly history = computed(() =>
    [...this.detail().patterns].sort((a, b) => b.validFrom.localeCompare(a.validFrom)),
  );
  protected readonly current = computed(
    () =>
      this.history().find(
        (p) =>
          p.validFrom <= this.detail().today && (!p.validTo || p.validTo >= this.detail().today),
      ) ??
      this.detail().employee.pattern ??
      null,
  );
}
