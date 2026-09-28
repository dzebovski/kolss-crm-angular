import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import type {
  LeadRating,
  UpdateLeadInfoRequest,
  V2StatusActivityRequest,
  LossReason,
} from '@core/api/generated/kolss-api.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { OFFICE_CONFIG, OFFICE_IDS } from '@core/office/office.config';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { isSuperAdminRole } from '@core/roles/roles';
import type { ContractCurrency, Lead, LeadEvent } from '@domain/lead.types';
import { formatV2ReminderDate, formatV2Time, formatV2TimeRange } from '@domain/v2/date-format';
import { isV2BudgetText, v2LocalDateTimeToIso } from '@domain/v2/lead-action';
import { toV2LeadCard } from '@domain/v2/lead-card.mapper';
import type { V2LeadColumns, V2LeadProduct } from '@domain/v2/lead-card.types';
import type { CrmEmployee } from '@services/users.service';
import {
  V2LeadCardService,
  V2SuccessfulCallPartialWriteError,
} from '@services/v2/v2-lead-card.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FieldGroup } from '../../ui/dialog/v2-field-group';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2DateTimeInput } from '../../ui/v2-date-time-input';
import { V2BudgetInput } from '../../ui/v2-budget-input';
import { V2_CHANNEL_LABEL } from '../../ui/v2-lead-labels';
import { V2_STATUS_LABEL } from '../../ui/v2-tone';
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
    save: 'v2.popup.noanswer.save',
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

/** An invitation is a 1-hour showroom event (design and API). */
const VISIT_MS = 60 * 60 * 1000;

interface StatusModel {
  date: string;
  comment: string;
  budget: string;
  currency: ContractCurrency;
  location: string;
  designerId: string;
  checklistBudget: boolean;
  checklistLocation: boolean;
  checklistPeriod: boolean;
  checklistMaterials: boolean;
  checklistProduct: boolean;
  clientInformed: boolean;
}

type ChecklistField =
  | 'checklistBudget'
  | 'checklistLocation'
  | 'checklistPeriod'
  | 'checklistMaterials'
  | 'checklistProduct'
  | 'clientInformed';

// Call result and lead status popups of lead card v1.3 (Successful call, Call later, No answer,
// Client thinking, Invited to showroom, Lost). The board's markup renders only the Comment box;
// the fields follow its JS model (contract §7): the date, the designer, the loss reason and the
// Successful call answers. No "Assign to" task field (decision D5). Saves one `v2_status`
// activity and closes with `true`.
@Component({
  selector: 'app-v2-status-dialog',
  imports: [
    FormField,
    TranslatePipe,
    V2DateTimeInput,
    V2BudgetInput,
    V2DialogShell,
    V2FieldGroup,
    V2FormField,
    V2ProductChips,
  ],
  templateUrl: './v2-status-dialog.html',
  styleUrl: './v2-status-dialog.scss',
})
export class V2StatusDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly service = inject(V2LeadCardService);
  protected readonly i18n = inject(I18nService);
  protected readonly data = inject<V2StatusDialogData>(DIALOG_DATA);

  protected readonly kind = this.data.kind;
  protected readonly copy = COPY[this.kind];
  protected readonly formatV2ReminderDate = formatV2ReminderDate;
  protected readonly formatV2Time = formatV2Time;
  protected readonly leadContext = computed(() => toV2LeadCard(this.data.lead, this.data.columns));
  protected readonly lossReasonsResource = resource({
    loader: () => (this.kind === 'lost' ? this.service.listV2LossReasons() : Promise.resolve([])),
  });
  protected readonly lossReasons = computed(() =>
    (this.lossReasonsResource.value() ?? []).map((reason) => ({
      id: reason.code,
      label: this.lossReasonLabel(reason),
    })),
  );

  private readonly initial: StatusModel = {
    date: '',
    comment: '',
    budget: this.data.columns.estimatedBudgetText ?? '',
    currency: this.data.lead.estimatedBudgetCurrency,
    location: this.data.lead.cityRegion,
    designerId: '',
    checklistBudget: this.data.columns.checklistBudget ?? false,
    checklistLocation: this.data.columns.checklistLocation ?? false,
    checklistPeriod: this.data.columns.checklistPeriod ?? false,
    checklistMaterials: this.data.columns.checklistMaterials ?? false,
    checklistProduct: this.data.columns.checklistProduct ?? false,
    clientInformed: this.data.columns.clientInformed ?? false,
  };
  protected readonly model = signal<StatusModel>({ ...this.initial });
  protected readonly status = form(this.model);
  protected readonly products = signal<readonly V2LeadProduct[]>(this.data.columns.products);
  protected readonly reasons = signal<readonly string[]>([]);
  protected readonly rating = signal<LeadRating | null>(this.data.columns.rating);
  protected readonly checklist: readonly {
    readonly field: Exclude<ChecklistField, 'clientInformed'>;
    readonly label: MessageKey;
  }[] = [
    { field: 'checklistBudget', label: 'v2.popup.success.checklistBudget' },
    { field: 'checklistLocation', label: 'v2.popup.success.checklistLocation' },
    { field: 'checklistPeriod', label: 'v2.popup.success.checklistPeriod' },
    { field: 'checklistMaterials', label: 'v2.popup.success.checklistMaterials' },
    { field: 'checklistProduct', label: 'v2.popup.success.checklistProduct' },
  ];
  protected readonly ratings: readonly {
    readonly value: LeadRating;
    readonly label: MessageKey;
  }[] = [
    { value: 'cold', label: 'v2.rating.cold' },
    { value: 'medium', label: 'v2.rating.medium' },
    { value: 'hot', label: 'v2.rating.hot' },
  ];
  protected readonly channelLabels = V2_CHANNEL_LABEL;
  protected readonly contactShowroomKey =
    OFFICE_CONFIG[this.data.lead.officeCode].showroomCardLabelKey;
  protected readonly checklistDoneCount = computed(
    () => this.checklist.filter((item) => this.model()[item.field]).length,
  );

  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  /** Set once Save is pressed while invalid; required-field errors stay hidden until then. */
  protected readonly touched = signal(false);

  /** Popup-rules.dc.html footer: how many required fields are still missing. */
  protected readonly missingCount = computed(() => {
    let count = 0;
    if (
      (this.copy.dateRequired && !this.validDueAt()) ||
      (!this.copy.dateRequired && this.model().date && !this.validDueAt())
    )
      count++;
    if (this.kind === 'invited' && !this.model().designerId) count++;
    if (this.kind === 'lost' && this.reasons().length === 0) count++;
    if (this.kind === 'lost' && this.requiresOtherComment() && !this.model().comment.trim())
      count++;
    if (this.kind === 'success' && !this.model().clientInformed) count++;
    if (!this.budgetValid()) count++;
    return count;
  });
  protected readonly invalid = computed(() => this.missingCount() > 0);
  /** "Lost" is the only red primary button (Popup-rules.dc.html "Button labels"). */
  protected readonly primaryVariant = this.kind === 'lost' ? 'danger' : 'primary';
  protected readonly hasUnsavedInput = computed(() => {
    const value = this.model();
    return (
      value.comment.trim() !== '' ||
      value.date !== '' ||
      value.designerId !== '' ||
      value.budget.trim() !== this.initial.budget.trim() ||
      value.currency !== this.initial.currency ||
      value.location.trim() !== this.initial.location.trim() ||
      value.checklistBudget !== this.initial.checklistBudget ||
      value.checklistLocation !== this.initial.checklistLocation ||
      value.checklistPeriod !== this.initial.checklistPeriod ||
      value.checklistMaterials !== this.initial.checklistMaterials ||
      value.checklistProduct !== this.initial.checklistProduct ||
      value.clientInformed !== this.initial.clientInformed ||
      this.reasons().length > 0 ||
      this.products().length !== this.data.columns.products.length ||
      this.rating() !== this.data.columns.rating
    );
  });

  protected readonly dateError = computed(() => {
    if (!this.touched()) return '';
    if (this.copy.dateRequired && !this.dueAt()) return this.i18n.t('v2.dialog.fieldRequired');
    return this.model().date && !this.isFutureDate()
      ? this.i18n.t('v2.popup.dateMustBeFuture')
      : '';
  });
  protected readonly designerError = computed(() =>
    this.touched() && this.kind === 'invited' && !this.model().designerId
      ? this.i18n.t('v2.dialog.fieldRequired')
      : '',
  );
  protected readonly reasonError = computed(() =>
    this.touched() && this.kind === 'lost' && this.reasons().length === 0
      ? this.i18n.t('v2.dialog.fieldRequired')
      : '',
  );
  protected readonly otherCommentError = computed(() =>
    this.touched() && this.requiresOtherComment() && !this.model().comment.trim()
      ? this.i18n.t('v2.popup.lost.otherCommentRequired')
      : '',
  );

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
  private readonly isFutureDate = computed(() => {
    const dueAt = this.dueAt();
    return dueAt !== null && new Date(dueAt).getTime() > this.data.now.getTime();
  });
  private readonly validDueAt = computed(() => this.dueAt() && this.isFutureDate());
  protected readonly budgetValid = computed(
    () => this.kind !== 'success' || isV2BudgetText(this.model().budget),
  );

  protected readonly error = computed(() =>
    this.budgetValid() ? this.saveError() : this.i18n.t('v2.leadInfo.budgetInvalid'),
  );
  protected readonly lossReasonsError = computed(() => {
    const error = this.lossReasonsResource.error();
    return error
      ? this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed')
      : '';
  });

  protected readonly canSave = computed(() => {
    if (this.saving() || !this.budgetValid()) return false;
    if (
      (this.copy.dateRequired && !this.validDueAt()) ||
      (!this.copy.dateRequired && this.model().date && !this.validDueAt())
    )
      return false;
    if (this.kind === 'invited' && !this.model().designerId) return false;
    if (this.kind === 'lost' && this.reasons().length === 0) return false;
    if (this.kind === 'lost' && this.requiresOtherComment()) return false;
    if (this.kind === 'success' && !this.model().clientInformed) return false;
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

  /** The matching status activity history is the only reliable source for the board's prior attempts. */
  protected readonly previousAttempts = computed(() =>
    this.data.lead.events
      .filter((event) => this.isSameStatusEvent(event))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
  );
  protected readonly attemptSummary = computed(() => {
    const count = this.previousAttempts().length;
    if (count === 0) return '';
    switch (this.kind) {
      case 'later':
        return this.i18n.t('v2.popup.later.previousCalls', { count });
      case 'noanswer':
        return this.i18n.t('v2.popup.noanswer.previousAttempts', { count });
      case 'thinking':
        return this.i18n.t('v2.popup.thinking.previousFollowUps', { count });
      default:
        return '';
    }
  });
  protected readonly nextAttemptSummary = computed(() => {
    if (this.kind === 'noanswer') {
      return this.i18n.t('v2.popup.noanswer.thisAttempt', {
        count: this.data.columns.noAnswerAttempts + 1,
      });
    }
    if (this.kind === 'later' || this.kind === 'thinking') {
      const count = this.previousAttempts().length + 1;
      return this.i18n.t(
        this.kind === 'later' ? 'v2.popup.later.thisCall' : 'v2.popup.thinking.thisFollowUp',
        { count },
      );
    }
    return '';
  });
  /** Design footer outcome, including the accurately derived next No answer attempt. */
  protected readonly hint = computed(() => {
    switch (this.kind) {
      case 'later':
        return this.i18n.t('v2.popup.later.footer');
      case 'noanswer':
        return this.i18n.t('v2.popup.noanswer.footerAttempt', {
          count: this.data.columns.noAnswerAttempts + 1,
        });
      case 'thinking':
        return this.i18n.t('v2.popup.thinking.footer');
      case 'invited':
        return this.i18n.t('v2.popup.invited.footer');
      case 'lost':
        return this.i18n.t('v2.popup.lost.footer');
      case 'success':
        return this.i18n.t('v2.popup.success.footer');
    }
  });
  protected readonly showrooms = computed(() =>
    OFFICE_IDS.map((id) => ({
      id,
      label: this.i18n.t(OFFICE_CONFIG[id].showroomCardLabelKey),
      sublabel: this.i18n.t(OFFICE_CONFIG[id].showroomCardSubKey),
      selected: id === this.data.lead.officeCode,
    })),
  );

  protected toggleReason(reason: string): void {
    this.reasons.update((reasons) =>
      reasons.includes(reason) ? reasons.filter((item) => item !== reason) : [...reasons, reason],
    );
  }

  protected toggleChecklist(field: ChecklistField): void {
    this.model.update((value) => ({ ...value, [field]: !value[field] }));
  }

  protected setBudget(budget: string): void {
    this.model.update((value) => ({ ...value, budget }));
  }

  protected setBudgetCurrency(currency: ContractCurrency): void {
    this.model.update((value) => ({ ...value, currency }));
  }

  protected selectRating(rating: LeadRating): void {
    this.rating.set(rating);
  }

  protected statusEventLabel(event: LeadEvent): string {
    switch (event.statusCode) {
      case 'callback_requested':
        return this.i18n.t(V2_STATUS_LABEL.later);
      case 'no_answer':
        return this.i18n.t(V2_STATUS_LABEL.noanswer);
      case 'thinking':
        return this.i18n.t(V2_STATUS_LABEL.thinking);
      default:
        return '';
    }
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.saveError.set('');
    try {
      if (this.kind === 'success') {
        await this.service.recordSuccessfulCall(this.data.lead, {
          info: this.successInfoRequest(),
          rating: this.rating() === this.data.columns.rating ? null : this.rating(),
          status: this.request(),
        });
      } else {
        await this.service.recordStatus(this.data.lead.id, this.request());
      }
      this.dialogRef.close(true);
    } catch (error) {
      this.saveError.set(
        error instanceof V2SuccessfulCallPartialWriteError
          ? this.i18n.t('v2.popup.success.partialSave')
          : this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
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
        const products = this.products();
        return {
          ...base,
          ...(budget ? { estimatedBudgetText: budget } : {}),
          ...(budget || value.currency !== this.initial.currency
            ? { estimatedBudgetCurrency: value.currency }
            : {}),
          ...(location || location !== this.initial.location.trim()
            ? { cityRegion: location }
            : {}),
          ...(products.length || this.data.columns.products.length
            ? { products: [...products] }
            : {}),
        };
      }
      case 'invited':
        return { ...base, designerId: value.designerId };
      case 'lost':
        return { ...base, lossReasons: [...this.reasons()] };
      default:
        return base;
    }
  }

  /** Only changed acknowledgements are PATCHed so untouched unknown values remain unknown. */
  private successInfoRequest(): UpdateLeadInfoRequest {
    const value = this.model();
    return {
      ...(value.checklistBudget !== this.initial.checklistBudget
        ? { checklistBudget: value.checklistBudget }
        : {}),
      ...(value.checklistLocation !== this.initial.checklistLocation
        ? { checklistLocation: value.checklistLocation }
        : {}),
      ...(value.checklistPeriod !== this.initial.checklistPeriod
        ? { checklistPeriod: value.checklistPeriod }
        : {}),
      ...(value.checklistMaterials !== this.initial.checklistMaterials
        ? { checklistMaterials: value.checklistMaterials }
        : {}),
      ...(value.checklistProduct !== this.initial.checklistProduct
        ? { checklistProduct: value.checklistProduct }
        : {}),
      ...(value.clientInformed !== this.initial.clientInformed
        ? { clientInformed: value.clientInformed }
        : {}),
    };
  }

  private requiresOtherComment(): boolean {
    return this.kind === 'lost' && this.reasons().includes('other') && !this.model().comment.trim();
  }

  private lossReasonLabel(reason: LossReason): string {
    const locale = this.i18n.locale();
    if (locale === 'en') return reason.label_en?.trim() || reason.label_pl || reason.label_uk;
    return locale === 'pl'
      ? reason.label_pl || reason.label_uk
      : reason.label_uk || reason.label_pl;
  }

  private isSameStatusEvent(event: LeadEvent): boolean {
    switch (this.kind) {
      case 'later':
        return event.category === 'call_status' && event.statusCode === 'callback_requested';
      case 'noanswer':
        return event.category === 'call_status' && event.statusCode === 'no_answer';
      case 'thinking':
        return event.category === 'client_status' && event.statusCode === 'thinking';
      default:
        return false;
    }
  }
}
