import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  signal,
} from '@angular/core';

import type { HrEmployeeDetail } from '@core/api/generated/kolss-api.types';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { addDays } from '@domain/hr/hr-dates';
import { hrInitials, hrName } from '@domain/hr/hr-entry';
import { HrService } from '@services/hr/hr.service';
import { V2FormField } from '../../v2/ui/dialog/v2-form-field';
import { V2Button } from '../../v2/ui/v2-button';
import { V2ToastService } from '../../v2/ui/toast/v2-toast';
import { HrSession } from '../hr-session';
import { HrText } from '../hr-text';

// Settings tab (HR-employee-settings.dc.html): office, linked account (read-only), position,
// start / end date and "Tracked in HR" (stop takes effect from tomorrow, history is kept).
@Component({
  selector: 'app-hr-employee-settings',
  imports: [TranslatePipe, V2Button, V2FormField],
  templateUrl: './hr-employee-settings.html',
  styleUrl: './hr-employee-tab.scss',
  styles: `
    @use '../ui/hr';
    @use '../../../../styles/v2/type';

    .hr-set {
      max-width: 720px;
      padding: 20px;
    }

    .hr-set__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 16px;
    }

    .hr-set__account {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 40px;
      padding: 0 12px;
      border-radius: var(--v2-radius-sm);
      background: var(--v2-surface-sunk);
      color: var(--v2-ink-2);
    }

    .hr-set__ini {
      @include type.text('label');

      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 999px;
      background: var(--v2-surface);
      font-weight: 600;
    }

    .hr-set__track {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: 16px;
      padding: 12px 0;
      border-top: 1px solid var(--v2-line-soft);
    }

    .hr-set__track-title {
      @include type.text('body-strong');

      margin: 0;
    }

    .hr-switch {
      position: relative;
      flex-shrink: 0;
      width: 40px;
      height: 24px;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: var(--v2-line);
      cursor: pointer;

      &::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: var(--v2-surface);
        transition: transform 0.15s ease;
      }

      &[aria-checked='true'] {
        background: var(--v2-ink);

        &::after {
          transform: translateX(16px);
        }
      }
    }

    .hr-set__confirm {
      @include hr.note(error);

      align-items: center;
    }

    .hr-set__confirm-text {
      flex: 1;
    }

    .hr-set__foot {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 16px;
      border-top: 1px solid var(--v2-line-soft);
    }

    @media (max-width: 640px) {
      .hr-set__grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class HrEmployeeSettings {
  private readonly hr = inject(HrService);
  private readonly toast = inject(V2ToastService);
  private readonly session = inject(HrSession);
  protected readonly text = inject(HrText);

  readonly detail = input.required<HrEmployeeDetail>();
  /** "More → Stop tracking" on the page header opens the confirmation here. */
  readonly stopRequested = model(false);

  private readonly employee = computed(() => this.detail().employee);
  protected readonly name = computed(() => hrName(this.employee()));
  protected readonly initials = computed(() => hrInitials(this.name()));
  protected readonly officeId = linkedSignal(() => this.employee().officeId);
  protected readonly position = linkedSignal(() => this.employee().position ?? '');
  protected readonly startedOn = linkedSignal(() => this.employee().startedOn);
  protected readonly endedOn = linkedSignal(() => this.employee().endedOn ?? '');
  protected readonly confirmStop = signal(false);
  protected readonly saving = signal(false);

  protected readonly offices = computed(() =>
    this.session.offices().map((o) => ({ value: o.id, label: this.text.officeName(o) })),
  );
  protected readonly dirty = computed(() => {
    const e = this.employee();
    return (
      this.officeId() !== e.officeId ||
      this.position() !== (e.position ?? '') ||
      this.startedOn() !== e.startedOn ||
      this.endedOn() !== (e.endedOn ?? '')
    );
  });
  protected readonly untrackedFrom = computed(() =>
    this.employee().trackedUntil ? addDays(this.employee().trackedUntil!, 1) : null,
  );

  constructor() {
    effect(() => {
      if (this.stopRequested() && this.employee().isTracked) {
        this.confirmStop.set(true);
        this.stopRequested.set(false);
      }
    });
  }

  protected discard(): void {
    const e = this.employee();
    this.officeId.set(e.officeId);
    this.position.set(e.position ?? '');
    this.startedOn.set(e.startedOn);
    this.endedOn.set(e.endedOn ?? '');
  }

  protected toggleTracked(): void {
    if (this.employee().isTracked) this.confirmStop.set(true);
    else void this.update({ tracked: true });
  }

  protected async stop(): Promise<void> {
    this.confirmStop.set(false);
    await this.update({ tracked: false });
  }

  protected async save(): Promise<void> {
    if (!this.startedOn()) return;
    await this.update({
      officeId: this.officeId(),
      position: this.position().trim() || null,
      startedOn: this.startedOn(),
      endedOn: this.endedOn() || null,
    });
  }

  private async update(body: Parameters<HrService['updateEmployee']>[1]): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.hr.updateEmployee(this.employee().id, body);
      this.toast.show(this.text.t('hr.toast.saved'));
    } catch (error) {
      this.toast.show(this.text.saveError(error, { today: this.detail().today }));
    } finally {
      this.saving.set(false);
    }
  }
}
