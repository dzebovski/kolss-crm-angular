import { Component, computed, inject, input, linkedSignal, output, resource } from '@angular/core';

import type { HrEmployeeDetail } from '@core/api/generated/kolss-api.types';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { HrService } from '@services/hr/hr.service';
import { V2Button } from '../../v2/ui/v2-button';
import { V2SegmentedControl, type V2SegmentOption } from '../../v2/ui/v2-segmented-control';
import { HrText } from '../hr-text';
import { HrBalanceTile } from '../ui/hr-balance-tile';

// Leave tab (HR-employee-leave.dc.html): year switch, Edit limit, limit / used / left-over /
// expiring tiles and the year's vacation entries with a running total.
@Component({
  selector: 'app-hr-employee-leave',
  imports: [HrBalanceTile, TranslatePipe, V2Button, V2SegmentedControl],
  template: `
    <div class="hr-bar">
      <app-v2-segmented-control
        [options]="yearOptions()"
        [value]="yearText()"
        [ariaLabel]="'hr.employee.leave.years' | translate"
        (valueChange)="year.set(+$event)"
      />
      <span class="hr-spacer"></span>
      <button type="button" appV2Button (click)="editLimit.emit()">
        {{ 'hr.employee.editLimit' | translate }}
      </button>
    </div>

    @if (leave(); as l) {
      <div class="hr-tiles">
        <app-hr-balance-tile
          [label]="'hr.employee.leave.limit' | translate"
          [value]="text.plural('hr.n.days', l.days)"
          [sub]="
            (l.isSet ? 'hr.employee.leave.custom' : 'hr.employee.leave.officeDefault') | translate
          "
        />
        <app-hr-balance-tile
          [label]="'hr.employee.leave.used' | translate"
          [value]="text.plural('hr.n.days', l.balance.used)"
          [sub]="text.plural('hr.n.workingDays', rows().length)"
          [used]="l.balance.used"
          [limit]="l.balance.limit"
        />
        <app-hr-balance-tile
          [label]="'hr.employee.leave.leftOver' | translate"
          [value]="
            l.balance.over > 0
              ? ('hr.employee.leave.overValue' | translate: { n: text.number(l.balance.over) })
              : ('hr.employee.leave.leftValue' | translate: { n: text.number(l.balance.left) })
          "
          [sub]="l.balance.over > 0 ? ('hr.employee.leave.allowed' | translate) : ''"
        />
        <app-hr-balance-tile
          [label]="'hr.employee.leave.expire' | translate"
          [value]="text.plural('hr.n.days', l.balance.left)"
          [sub]="'hr.employee.leave.noCarry' | translate"
          [empty]="l.balance.left === 0"
        />
      </div>
    }

    <section
      class="hr-card"
      role="table"
      [attr.aria-label]="'hr.employee.leave.entriesYear' | translate: { year: year() }"
    >
      <div class="hr-tbl-title">
        <h2 class="hr-sch__h2">
          {{ 'hr.employee.leave.entriesYear' | translate: { year: year() } }}
        </h2>
      </div>
      <div class="hr-tr hr-th" role="row">
        <span role="columnheader">{{ 'hr.employee.leave.dates' | translate }}</span>
        <span role="columnheader">{{ 'hr.employee.leave.workingDays' | translate }}</span>
        <span role="columnheader">{{ 'hr.employee.leave.total' | translate }}</span>
        <span role="columnheader">{{ 'hr.employee.entries.comment' | translate }}</span>
        <span role="columnheader">{{ 'hr.employee.entries.added' | translate }}</span>
      </div>
      @for (r of rows(); track r.id) {
        <div class="hr-tr" role="row">
          <span role="cell">{{ r.dates }}</span>
          <span role="cell" class="hr-mono">{{ r.days }}</span>
          <span role="cell">
            <span [class]="r.over ? 'hr-tag--warn' : 'hr-mono'">{{ r.total }}</span>
          </span>
          <span role="cell" class="hr-caption">{{ r.comment }}</span>
          <span role="cell" class="hr-caption">{{ r.added }}</span>
        </div>
      } @empty {
        <p class="hr-empty">{{ 'hr.employee.leave.empty' | translate: { year: year() } }}</p>
      }
    </section>
  `,
  styleUrl: './hr-employee-tab.scss',
  host: { style: '--hr-cols: 220px 140px 160px minmax(0, 1fr) 160px' },
  styles: `
    .hr-spacer {
      flex: 1;
    }
  `,
})
export class HrEmployeeLeave {
  private readonly hr = inject(HrService);
  protected readonly text = inject(HrText);

  readonly detail = input.required<HrEmployeeDetail>();
  readonly editLimit = output<void>();

  protected readonly year = linkedSignal(() => Number(this.detail().today.slice(0, 4)));
  protected readonly yearOptions = computed<V2SegmentOption<string>[]>(() =>
    [...this.detail().leave]
      .sort((a, b) => a.year - b.year)
      .map((l) => ({ value: String(l.year), label: String(l.year) })),
  );
  protected readonly yearText = computed(() => String(this.year()));
  protected readonly leave = computed(() =>
    this.detail().leave.find((l) => l.year === this.year()),
  );

  private readonly entries = resource({
    params: () => ({ id: this.detail().employee.id, year: this.year(), v: this.hr.changes() }),
    loader: ({ params }) =>
      this.hr.entries({
        employeeId: params.id,
        type: 'vacation',
        from: `${params.year}-01-01`,
        to: `${params.year}-12-31`,
      }),
  });

  protected readonly rows = computed(() => {
    const list = this.entries.hasValue() ? [...this.entries.value()] : [];
    const limit = this.leave()?.days ?? 0;
    let run = 0;
    return list
      .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
      .map((e) => {
        run += e.days;
        const over = run - limit;
        return {
          id: e.id,
          dates: this.dates(e.dateFrom, e.dateTo),
          days: this.text.number(e.days),
          total: this.text.t(
            over > 0 ? 'hr.employee.leave.totalOver' : 'hr.employee.leave.totalValue',
            {
              n: this.text.number(run),
              limit: this.text.number(limit),
              over: this.text.number(over),
            },
          ),
          over: over > 0,
          comment: e.comment ?? '',
          added: this.text.dateTime(e.createdAt),
        };
      });
  });

  private dates(from: string, to: string): string {
    return from === to ? this.text.day(from) : `${this.text.day(from)} – ${this.text.day(to)}`;
  }
}
