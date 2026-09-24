import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import type { V2LossReason, V2StatusActivityRequest } from '@core/api/generated/kolss-api.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { isSuperAdminRole } from '@core/roles/roles';
import type { Lead } from '@domain/lead.types';
import { formatV2ReminderDate, formatV2TimeRange } from '@domain/v2/date-format';
import { isV2BudgetText, v2LocalDateTimeToIso } from '@domain/v2/lead-action';
import type { V2LeadColumns, V2LeadProduct } from '@domain/v2/lead-card.types';
import type { CrmEmployee } from '@services/users.service';
import { V2LeadCardService } from '@services/v2/v2-lead-card.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import type { V2CallResult, V2StatusChange } from './v2-lead-action-panel';
import { V2ProductChips } from './v2-product-chips';

export type V2StatusKind = V2CallResult | V2StatusChange;

export interface V2StatusDialogData {
  readonly kind: V2StatusKind;
  readonly lead: Lead;
  readonly columns: V2LeadColumns;
  readonly employees: readonly CrmEmployee[];
  readonly now: Date;
}

interface Copy {
  readonly title: MessageKey;
  readonly subtitle: MessageKey;
  readonly save: MessageKey;
  /** Date field label; absent = no date (Lost). */
  readonly date?: MessageKey;
  readonly dateRequired?: boolean;
}

// Lead card v1.3 `MODALS`.
const COPY: Record<V2StatusKind, Copy> = {
  success: {
    title: 'v2.status.success',
    subtitle: 'v2.popup.success.subtitle',
    save: 'v2.popup.success.save',
    date: 'v2.popup.success.date',
  },
  later: {
    title: 'v2.status.later',
    subtitle: 'v2.popup.later.subtitle',
    save: 'v2.popup.setReminder',
    date: 'v2.popup.later.date',
    dateRequired: true,
  },
  noanswer: {
    title: 'v2.status.noanswer',
    subtitle: 'v2.popup.noanswer.subtitle',
    save: 'v2.popup.setReminder',
    date: 'v2.popup.noanswer.date',
    dateRequired: true,
  },
  thinking: {
    title: 'v2.status.thinking',
    subtitle: 'v2.popup.thinking.subtitle',
    save: 'v2.popup.thinking.save',
    date: 'v2.popup.thinking.date',
    dateRequired: true,
  },
  invited: {
    title: 'v2.status.invited',
    subtitle: 'v2.popup.invited.subtitle',
    save: 'v2.popup.invited.save',
    date: 'v2.popup.invited.date',
    dateRequired: true,
  },
  lost: {
    title: 'v2.popup.lost.title',
    subtitle: 'v2.popup.lost.subtitle',
    save: 'v2.popup.lost.save',
  },
};

/** Design `REASONS`; `other` reuses the existing code. */
const LOSS_REASONS: readonly V2LossReason[] = [
  'bought_elsewhere',
  'out_of_budget',
  'not_relevant',
  'cant_reach_client',
  'other',
];

/** An invitation is a 1-hour showroom event (design and API). */
const VISIT_MS = 60 * 60 * 1000;

interface StatusModel {
  date: string;
  comment: string;
  budget: string;
  location: string;
  nextAction: string;
  designerId: string;
}

// Call result and lead status popups of lead card v1.3 (Successful call, Call later, No answer,
// Client thinking, Invited to showroom, Lost). The board's markup renders only the Comment box;
// the fields follow its JS model (contract §7): the date, the designer, the loss reason and the
// Successful call answers. No "Assign to" task field (decision D5). Saves one `v2_status`
// activity and closes with `true`.
@Component({
  selector: 'app-v2-status-dialog',
  imports: [FormField, TranslatePipe, V2DialogShell, V2FormField, V2ProductChips],
  templateUrl: './v2-status-dialog.html',
  styleUrl: './v2-status-dialog.scss',
})
export class V2StatusDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly service = inject(V2LeadCardService);
  private readonly i18n = inject(I18nService);
  protected readonly data = inject<V2StatusDialogData>(DIALOG_DATA);

  protected readonly kind = this.data.kind;
  protected readonly copy = COPY[this.kind];
  protected readonly lossReasons = computed(() =>
    LOSS_REASONS.map((reason) => ({ id: reason, label: this.i18n.closeReasonLabel(reason) })),
  );

  private readonly initial: StatusModel = {
    date: '',
    comment: '',
    budget: this.data.columns.estimatedBudgetText ?? '',
    location: this.data.lead.cityRegion,
    nextAction: '',
    designerId: '',
  };
  protected readonly model = signal<StatusModel>({ ...this.initial });
  protected readonly status = form(this.model);
  protected readonly products = signal<readonly V2LeadProduct[]>(this.data.columns.products);
  protected readonly reason = signal<V2LossReason | null>(null);

  protected readonly saving = signal(false);
  protected readonly saveError = signal('');

  /** Designers: active staff of the lead's office (API rule, contract decision 14). */
  protected readonly designers = computed(() =>
    this.data.employees
      .filter(
        (employee) =>
          employee.status === 'active' &&
          !isSuperAdminRole(employee.role) &&
          employee.officeIds.includes(this.data.lead.officeCode),
      )
      .map((employee) => ({ id: employee.id, name: employee.displayName })),
  );

  private readonly dueAt = computed(() => v2LocalDateTimeToIso(this.model().date));
  private readonly budgetValid = computed(
    () => this.kind !== 'success' || isV2BudgetText(this.model().budget),
  );

  protected readonly error = computed(() =>
    this.budgetValid() ? this.saveError() : this.i18n.t('v2.leadInfo.budgetInvalid'),
  );

  protected readonly canSave = computed(() => {
    if (this.saving() || !this.budgetValid()) return false;
    if (this.copy.dateRequired && !this.dueAt()) return false;
    if (this.kind === 'invited' && !this.model().designerId) return false;
    if (this.kind === 'lost' && !this.reason()) return false;
    return true;
  });

  /** Design `calendarNote` for the invitation. */
  protected readonly calendarNote = computed(() => {
    const start = this.dueAt();
    if (!start) return this.i18n.t('v2.popup.invited.pickDate');
    const end = new Date(new Date(start).getTime() + VISIT_MS);
    const when = `${formatV2ReminderDate(start, this.data.now, this.i18n.locale())}, ${formatV2TimeRange(start, end)}`;
    const designer = this.designers().find((item) => item.id === this.model().designerId)?.name;
    return this.i18n.t('v2.popup.invited.event', {
      when: designer ? `${when} · ${designer}` : when,
    });
  });

  /** Design `footNote`. */
  protected readonly hint = computed(() =>
    this.kind === 'noanswer'
      ? this.i18n.t('v2.popup.noanswer.attempt', { count: this.data.columns.noAnswerAttempts + 1 })
      : this.i18n.t('v2.dialog.autoAuthor'),
  );

  protected pickReason(reason: V2LossReason): void {
    this.reason.set(reason);
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.saveError.set('');
    try {
      await this.service.recordStatus(this.data.lead.id, this.request());
      this.dialogRef.close(true);
    } catch (error) {
      this.saveError.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private request(): Omit<V2StatusActivityRequest, 'type'> {
    const value = this.model();
    const comment = value.comment.trim();
    const dueAt = this.dueAt();
    const base = {
      status: this.kind,
      ...(comment ? { comment } : {}),
      ...(dueAt && this.kind !== 'lost' ? { dueAt } : {}),
    };
    switch (this.kind) {
      case 'success': {
        const budget = value.budget.trim();
        const location = value.location.trim();
        const nextAction = value.nextAction.trim();
        const products = this.products();
        return {
          ...base,
          ...(budget ? { estimatedBudgetText: budget } : {}),
          ...(location || location !== this.initial.location.trim()
            ? { cityRegion: location }
            : {}),
          ...(products.length || this.data.columns.products.length
            ? { products: [...products] }
            : {}),
          ...(nextAction ? { nextAction } : {}),
        };
      }
      case 'invited':
        return { ...base, designerId: value.designerId };
      case 'lost':
        return { ...base, lossReason: this.reason() ?? 'other' };
      default:
        return base;
    }
  }
}
