import { Component, computed, effect, inject, InjectionToken, output, signal } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { normalizePhoneForOffice } from '../../../core/phone/phone';
import { SessionService } from '../../../core/session/session.service';
import type { LeadSource } from '../../../services/crm-mock.types';
import { LeadsService } from '../../../services/leads.service';
import { UiButton } from '../../../ui/button/ui-button';
import { UiModal } from '../../../ui/dialog/ui-modal';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';
import { UiTextField } from '../../../ui/form/ui-text-field';
import { UiTextarea } from '../../../ui/form/ui-textarea';

const OFFICE_TIME_ZONES: Readonly<Record<string, string>> = {
  kyiv: 'Europe/Kyiv',
  warsaw: 'Europe/Warsaw',
};

export const CREATE_LEAD_NOW = new InjectionToken<() => Date>('CREATE_LEAD_NOW', {
  factory: () => () => new Date(),
});

export function sourceDateForOffice(now: Date, officeCode: string): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: OFFICE_TIME_ZONES[officeCode],
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type === 'year' || part.type === 'month' || part.type === 'day')
      .map((part) => [part.type, part.value]),
  );
  return `${parts['year']}-${parts['month']}-${parts['day']}`;
}

@Component({
  selector: 'app-create-lead-dialog',
  imports: [UiButton, UiModal, UiSelect, UiTextField, UiTextarea, TranslatePipe],
  template: `
    <app-ui-modal [wide]="true" labelledBy="create-lead-dialog-title" (dismissed)="dismiss()">
      <h2 id="create-lead-dialog-title">{{ 'lead.create' | translate }}</h2>
      <p>{{ 'lead.createHint' | translate }}</p>

      @if (error()) {
        <div class="inline-error" role="alert">{{ error() }}</div>
      }

      <div class="modal-section">
        <h3>Офіс і джерело</h3>
        <div class="modal-grid">
          <app-ui-select
            label="Офіс"
            placeholder="Оберіть офіс"
            [required]="true"
            [error]="officeIdError()"
            [options]="officeOptions()"
            [value]="officeId()"
            (valueChange)="changeOffice($event)"
          />
          <app-ui-select
            label="Джерело"
            [required]="true"
            [error]="sourceError()"
            [options]="sourceOptions()"
            [(value)]="source"
          />
        </div>
      </div>

      <div class="modal-section">
        <h3>Контакти</h3>
        <div class="modal-grid">
          <app-ui-text-field
            label="Імʼя"
            [required]="true"
            [error]="nameError()"
            [(value)]="name"
          />
          <app-ui-text-field
            label="Телефон"
            type="tel"
            [required]="true"
            [error]="phoneError()"
            [(value)]="phone"
          />
          <app-ui-text-field label="Email" type="email" [error]="emailError()" [(value)]="email" />
          <app-ui-text-field label="Місто / район" [(value)]="cityRegion" />
        </div>
      </div>

      <div class="modal-section">
        <h3>Дані ліда</h3>
        <div class="modal-grid">
          <app-ui-text-field
            label="Дата ліда"
            type="date"
            name="lead-source-date"
            [required]="true"
            [error]="sourceDateError()"
            [value]="sourceDate()"
            (valueChange)="changeSourceDate($event)"
          />
          <app-ui-text-field
            label="Час ліда"
            type="time"
            name="lead-source-time"
            [required]="true"
            [error]="sourceTimeError()"
            [value]="sourceTime()"
            (valueChange)="changeSourceTime($event)"
          />
          <app-ui-text-field label="Продукт" [(value)]="productInterest" />
          <app-ui-text-field label="Бюджет, EUR" [error]="budgetError()" [(value)]="budget" />
        </div>
        <app-ui-textarea label="Початкове повідомлення" [rows]="4" [(value)]="initialMessage" />
      </div>

      <div class="modal-actions">
        <app-ui-button variant="ghost" (pressed)="dismiss()">Скасувати</app-ui-button>
        <app-ui-button [loading]="submitting()" [disabled]="submitting()" (pressed)="submit()">
          Створити
        </app-ui-button>
      </div>
    </app-ui-modal>
  `,
  styles: `
    h3 {
      margin: 0;
      font-size: 0.875rem;
    }

    .inline-error {
      padding: var(--ui-space-3) var(--ui-space-4);
      border: 1px solid color-mix(in srgb, var(--ui-danger) 24%, white);
      border-radius: var(--ui-radius-md);
      background: var(--ui-danger-soft);
      color: var(--ui-danger);
      font-size: 0.875rem;
      font-weight: 650;
    }

    .modal-section {
      display: grid;
      gap: var(--ui-space-3);
    }

    .modal-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ui-space-4);
      align-items: start;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--ui-space-2);
    }

    @media (max-width: 48rem) {
      .modal-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class CreateLeadDialog {
  private readonly session = inject(SessionService);
  private readonly leadsService = inject(LeadsService);
  private readonly i18n = inject(I18nService);
  private readonly now = inject(CREATE_LEAD_NOW);

  readonly dismissed = output<void>();
  readonly created = output<string>();

  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected readonly officeIdError = signal('');
  protected readonly sourceError = signal('');
  protected readonly nameError = signal('');
  protected readonly phoneError = signal('');
  protected readonly emailError = signal('');
  protected readonly budgetError = signal('');
  protected readonly sourceDateError = signal('');
  protected readonly sourceTimeError = signal('');

  protected readonly officeId = signal(this.defaultOfficeId());
  protected readonly source = signal<LeadSource>('office');
  protected readonly name = signal('');
  protected readonly phone = signal('');
  protected readonly email = signal('');
  protected readonly cityRegion = signal('');
  protected readonly productInterest = signal('');
  protected readonly budget = signal('');
  protected readonly initialMessage = signal('');
  protected readonly sourceDate = signal(this.defaultSourceDate());
  protected readonly sourceTime = signal('12:00');

  private sourceDateEdited = false;

  protected readonly sourceOptions = computed((): readonly UiSelectOption[] =>
    (['office', 'website', 'facebook', 'other'] as const).map((value) => ({
      value,
      label: this.i18n.sourceLabel(value),
    })),
  );

  protected readonly officeOptions = computed<readonly UiSelectOption[]>(() => {
    const offices = this.session.officeContext()?.filterOffices ?? [];
    return offices.map((office) => ({
      value: office.id,
      label: this.i18n.officeFilterLabel(office.code),
    }));
  });

  constructor() {
    effect(() => {
      this.source();
      this.sourceError.set('');
    });
    effect(() => {
      this.name();
      this.nameError.set('');
    });
    effect(() => {
      this.phone();
      this.phoneError.set('');
    });
    effect(() => {
      this.email();
      this.emailError.set('');
    });
    effect(() => {
      this.budget();
      this.budgetError.set('');
    });
  }

  protected dismiss(): void {
    this.dismissed.emit();
  }

  protected changeOffice(officeId: string): void {
    this.officeId.set(officeId);
    this.officeIdError.set('');
    if (!this.sourceDateEdited) {
      this.sourceDate.set(sourceDateForOffice(this.now(), this.officeCode(officeId)));
      this.sourceDateError.set('');
    }
  }

  protected changeSourceDate(value: string): void {
    this.sourceDateEdited = true;
    this.sourceDate.set(value);
    this.sourceDateError.set('');
  }

  protected changeSourceTime(value: string): void {
    this.sourceTime.set(value);
    this.sourceTimeError.set('');
  }

  protected async submit(): Promise<void> {
    this.error.set('');
    if (this.submitting()) return;

    const officeId = this.officeId();
    const source = this.source();
    const name = this.name().trim();
    const phoneRaw = this.phone().trim();
    const email = this.nullableText(this.email());
    const estimatedBudget = this.parseOptionalMoney(this.budget());
    const sourceDate = this.sourceDate().trim();
    const sourceTime = this.sourceTime().trim();
    const officeCode =
      (this.session.officeContext()?.filterOffices ?? []).find((office) => office.id === officeId)
        ?.code ?? 'kyiv';
    const phone = normalizePhoneForOffice(phoneRaw, officeCode);

    let valid = true;
    if (!officeId) {
      this.officeIdError.set('Оберіть офіс.');
      valid = false;
    }
    if (!source) {
      this.sourceError.set('Оберіть джерело.');
      valid = false;
    }
    if (!name) {
      this.nameError.set('Вкажіть імʼя клієнта.');
      valid = false;
    }
    if (!phoneRaw) {
      this.phoneError.set(this.i18n.t('lead.phoneRequired'));
      valid = false;
    } else if (!phone) {
      this.phoneError.set(this.i18n.t('lead.phoneInvalid'));
      valid = false;
    }
    if (email && !this.isValidEmail(email)) {
      this.emailError.set('Email має некоректний формат.');
      valid = false;
    }
    if (Number.isNaN(estimatedBudget) || (estimatedBudget != null && estimatedBudget < 0)) {
      this.budgetError.set('Бюджет має бути додатним числом або порожнім.');
      valid = false;
    }
    if (!this.isValidDate(sourceDate)) {
      this.sourceDateError.set(sourceDate ? 'Дата має некоректний формат.' : 'Вкажіть дату ліда.');
      valid = false;
    }
    if (!this.isValidTime(sourceTime)) {
      this.sourceTimeError.set(sourceTime ? 'Час має некоректний формат.' : 'Вкажіть час ліда.');
      valid = false;
    }
    if (!valid || !phone) return;

    this.submitting.set(true);
    try {
      const lead = await this.leadsService.createLead({
        officeId,
        source,
        name,
        phone,
        email,
        cityRegion: this.cityRegion().trim(),
        productInterest: this.productInterest().trim(),
        estimatedBudget,
        initialMessage: this.initialMessage().trim(),
        sourceCreatedAtLocal: `${sourceDate}T${sourceTime}`,
      });
      this.created.emit(lead.id);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Не вдалося створити лід');
    } finally {
      this.submitting.set(false);
    }
  }

  private defaultOfficeId(): string {
    return this.session.selectedOfficeId() ?? '';
  }

  private defaultSourceDate(): string {
    return sourceDateForOffice(this.now(), this.officeCode(this.defaultOfficeId()));
  }

  private officeCode(officeId: string): string {
    return (
      (this.session.officeContext()?.filterOffices ?? []).find((office) => office.id === officeId)
        ?.code ?? ''
    );
  }

  private nullableText(value: string): string | null {
    const text = value.trim();
    return text || null;
  }

  private parseOptionalMoney(value: string): number | null {
    const normalized = value.trim();
    return normalized ? this.parseMoney(normalized) : null;
  }

  private parseMoney(value: string): number {
    return Number(value.replace(/\s/g, '').replace(',', '.'));
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private isValidDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const [, year, month, day] = match;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return (
      parsed.getUTCFullYear() === Number(year) &&
      parsed.getUTCMonth() === Number(month) - 1 &&
      parsed.getUTCDate() === Number(day)
    );
  }

  private isValidTime(value: string): boolean {
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  }
}
