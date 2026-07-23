import { computed, inject, signal } from '@angular/core';
import { Component } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { KolssApiError } from '../../../core/api/generated/kolss-api.client';
import type { Appointment } from '../../../core/api/generated/kolss-api.types';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { Office } from '../../../models/database';
import type { MockLead } from '../../../services/crm-mock.types';
import { AppointmentsService, officeDateTimeParts } from '../../../services/appointments.service';
import { LeadsService } from '../../../services/leads.service';
import type { CrmEmployee } from '../../../services/users.service';
import { UiButton } from '../../../ui/button/ui-button';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';
import { UiTextField } from '../../../ui/form/ui-text-field';
import { UiTextarea } from '../../../ui/form/ui-textarea';
import { UiIcon } from '../../../ui/icon/ui-icon';

export interface AppointmentDrawerData {
  readonly office: Office;
  readonly managers: readonly CrmEmployee[];
  readonly appointment?: Appointment;
  readonly lead?: MockLead;
  readonly date?: string;
  readonly time?: string;
  readonly defaultManagerId?: string;
  readonly appointments?: readonly Appointment[];
}

export type AppointmentDrawerResult =
  { readonly kind: 'saved'; readonly appointment: Appointment } | { readonly kind: 'stale' };

interface AppointmentFormModel {
  readonly date: string;
  readonly time: string;
  readonly duration: string;
  readonly managerId: string;
  readonly comment: string;
}

@Component({
  selector: 'app-appointment-drawer',
  imports: [FormField, UiButton, UiIcon, UiSelect, UiTextField, UiTextarea],
  template: `
    <aside class="appointment-drawer" aria-labelledby="appointment-drawer-title">
      <header class="drawer-head">
        <div>
          <p>{{ data.office.name_uk }} · {{ data.office.timezone_name ?? 'UTC' }}</p>
          <h2 id="appointment-drawer-title">
            {{ data.appointment ? i18n.t('calendar.editTitle') : i18n.t('calendar.createTitle') }}
          </h2>
        </div>
        <button
          type="button"
          class="icon-button"
          [attr.aria-label]="i18n.t('common.close')"
          (click)="close()"
        >
          <app-ui-icon name="close" [size]="20" />
        </button>
      </header>

      <form (submit)="save($event)">
        <div class="drawer-body">
          @if (selectedLead(); as lead) {
            <div class="selected-lead">
              <span class="selected-lead__avatar">{{ lead.name.slice(0, 1).toUpperCase() }}</span>
              <span>
                <strong>{{ lead.name }}</strong>
                <small>{{ lead.phone }}</small>
              </span>
              @if (!data.appointment && !data.lead) {
                <button type="button" (click)="clearLead()">{{ i18n.t('common.clear') }}</button>
              }
            </div>
          } @else {
            <div class="lead-combobox">
              <app-ui-text-field
                type="search"
                [label]="i18n.t('calendar.client')"
                [placeholder]="i18n.t('calendar.clientSearch')"
                [value]="leadSearch()"
                (valueChange)="searchLeads($event)"
              />
              @if (searchingLeads()) {
                <p class="field-state" role="status">{{ i18n.t('common.loading') }}</p>
              } @else if (leadResults().length) {
                <ul
                  class="lead-results"
                  role="listbox"
                  [attr.aria-label]="i18n.t('calendar.client')"
                >
                  @for (lead of leadResults(); track lead.id) {
                    <li>
                      <button
                        type="button"
                        role="option"
                        aria-selected="false"
                        (click)="selectLead(lead)"
                      >
                        <strong>{{ lead.name }}</strong>
                        <span>{{ lead.phone }}</span>
                      </button>
                    </li>
                  }
                </ul>
              } @else if (leadSearch().trim().length >= 2) {
                <p class="field-state">{{ i18n.t('calendar.noClients') }}</p>
              }
            </div>
          }

          <div class="date-row">
            <app-ui-text-field
              type="date"
              [label]="i18n.t('common.date')"
              [formField]="appointmentForm.date"
            />
            <app-ui-text-field
              type="time"
              [label]="i18n.t('calendar.time')"
              [formField]="appointmentForm.time"
            />
          </div>

          <div class="date-row">
            <app-ui-select
              [label]="i18n.t('calendar.duration')"
              [options]="durationOptions"
              [formField]="appointmentForm.duration"
            />
            <app-ui-select
              [label]="i18n.t('common.manager')"
              [options]="managerOptions()"
              [formField]="appointmentForm.managerId"
            />
          </div>

          <app-ui-textarea
            [label]="i18n.t('calendar.comment')"
            [rows]="4"
            [formField]="appointmentForm.comment"
          />

          @if (clientWarnings().length) {
            <div class="warnings" role="status">
              @for (warning of clientWarnings(); track warning) {
                <p>
                  <app-ui-icon name="warning" [size]="18" />
                  {{ warning }}
                </p>
              }
            </div>
          }
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
        </div>

        @if (data.appointment?.status === 'scheduled') {
          <div class="status-actions" [attr.aria-label]="i18n.t('calendar.statusActions')">
            <app-ui-button size="small" variant="secondary" (pressed)="setStatus('visited')">
              {{ i18n.t('calendar.visited') }}
            </app-ui-button>
            <app-ui-button size="small" variant="secondary" (pressed)="setStatus('no_show')">
              {{ i18n.t('calendar.noShow') }}
            </app-ui-button>
            <app-ui-button size="small" variant="ghost" (pressed)="setStatus('canceled')">
              {{ i18n.t('calendar.cancelAppointment') }}
            </app-ui-button>
          </div>
        }

        <footer class="drawer-actions">
          <app-ui-button variant="ghost" (pressed)="close()">
            {{ i18n.t('common.cancel') }}
          </app-ui-button>
          <app-ui-button
            type="submit"
            [loading]="appointmentForm().submitting()"
            [disabled]="appointmentForm().invalid() || !selectedLead()"
          >
            {{ i18n.t('common.save') }}
          </app-ui-button>
        </footer>
      </form>
    </aside>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .appointment-drawer {
      width: min(31rem, 100vw);
      height: 100%;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      background: var(--ui-surface-raised);
      color: var(--ui-text);
    }

    form {
      min-height: 0;
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto auto;
    }

    .drawer-head,
    .drawer-actions,
    .status-actions {
      padding: var(--ui-space-5);
      border-bottom: 1px solid var(--ui-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-space-3);
    }

    .drawer-head {
      background:
        radial-gradient(
          circle at 100% 0,
          color-mix(in srgb, var(--ui-coral) 12%, transparent),
          transparent 44%
        ),
        var(--ui-surface-raised);
    }

    .drawer-head p {
      margin: 0 0 var(--ui-space-1);
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    h2 {
      margin: 0;
      font: 700 1.35rem/1.2 var(--ui-font-display);
    }

    .icon-button {
      width: 2.5rem;
      height: 2.5rem;
      border: 0;
      border-radius: 50%;
      background: var(--ui-surface-muted);
      color: inherit;
      cursor: pointer;
      display: grid;
      place-items: center;
    }

    .drawer-body {
      padding: var(--ui-space-5);
      overflow: auto;
      display: grid;
      align-content: start;
      gap: var(--ui-space-4);
    }

    .selected-lead {
      padding: var(--ui-space-3);
      border: 1px solid color-mix(in srgb, var(--ui-action) 24%, var(--ui-border));
      border-radius: var(--ui-radius-md);
      background: color-mix(in srgb, var(--ui-action) 5%, var(--ui-surface-raised));
      display: flex;
      align-items: center;
      gap: var(--ui-space-3);
    }

    .selected-lead__avatar {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      background: var(--ui-brand-gradient);
      color: white;
      display: grid;
      place-items: center;
      font-weight: 750;
    }

    .selected-lead > span:nth-child(2) {
      min-width: 0;
      display: grid;
      flex: 1;
    }

    .selected-lead small,
    .lead-results span {
      color: var(--ui-text-muted);
    }

    .selected-lead button {
      border: 0;
      background: transparent;
      color: var(--ui-action);
      cursor: pointer;
      font-weight: 650;
    }

    .lead-combobox {
      position: relative;
    }

    .lead-results {
      max-height: 15rem;
      margin: calc(var(--ui-space-2) * -1) 0 0;
      padding: var(--ui-space-2);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-2);
      list-style: none;
      overflow: auto;
    }

    .lead-results button {
      width: 100%;
      padding: var(--ui-space-3);
      border: 0;
      border-radius: var(--ui-radius-sm);
      background: transparent;
      color: inherit;
      cursor: pointer;
      display: grid;
      gap: var(--ui-space-1);
      text-align: left;
    }

    .lead-results button:hover,
    .lead-results button:focus-visible {
      background: var(--ui-surface-muted);
    }

    .date-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ui-space-3);
    }

    .field-state,
    .error {
      margin: 0;
      color: var(--ui-text-muted);
      font-size: 0.8125rem;
    }

    .error {
      color: var(--ui-danger);
    }

    .warnings {
      padding: var(--ui-space-3);
      border: 1px solid color-mix(in srgb, var(--ui-warning) 35%, var(--ui-border));
      border-radius: var(--ui-radius-md);
      background: color-mix(in srgb, var(--ui-warning) 9%, var(--ui-surface-raised));
    }

    .warnings p {
      margin: 0;
      display: flex;
      gap: var(--ui-space-2);
      align-items: center;
      font-size: 0.8125rem;
    }

    .warnings p + p {
      margin-top: var(--ui-space-2);
    }

    .status-actions {
      justify-content: flex-start;
      flex-wrap: wrap;
      border-top: 1px solid var(--ui-border);
      border-bottom: 0;
    }

    .drawer-actions {
      justify-content: flex-end;
      border-top: 1px solid var(--ui-border);
      border-bottom: 0;
    }

    @media (max-width: 520px) {
      .appointment-drawer {
        width: 100vw;
      }

      .date-row {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class AppointmentDrawer {
  protected readonly data = inject<AppointmentDrawerData>(MAT_DIALOG_DATA);
  protected readonly i18n = inject(I18nService);
  private readonly dialogRef = inject(
    MatDialogRef<AppointmentDrawer, AppointmentDrawerResult | undefined>,
  );
  private readonly appointments = inject(AppointmentsService);
  private readonly leads = inject(LeadsService);
  private readonly auth = inject(AuthService);

  protected readonly error = signal('');
  protected readonly searchingLeads = signal(false);
  protected readonly leadSearch = signal('');
  protected readonly leadResults = signal<readonly MockLead[]>([]);
  protected readonly selectedLead = signal<MockLead | null>(
    this.data.lead ?? this.leadFromAppointment(this.data.appointment),
  );
  private searchSequence = 0;

  private readonly initial = this.initialModel();
  protected readonly model = signal<AppointmentFormModel>(this.initial);
  protected readonly appointmentForm = form(this.model, (path) => {
    required(path.date, { message: this.i18n.t('calendar.dateRequired') });
    required(path.time, { message: this.i18n.t('calendar.timeRequired') });
    required(path.duration, { message: this.i18n.t('calendar.durationRequired') });
    required(path.managerId, { message: this.i18n.t('calendar.managerRequired') });
  });

  protected readonly durationOptions: readonly UiSelectOption[] = [30, 60, 90, 120].map(
    (minutes) => ({
      value: String(minutes),
      label: this.i18n.t('calendar.minutes', { count: minutes }),
    }),
  );

  protected readonly managerOptions = computed<readonly UiSelectOption[]>(() =>
    this.data.managers
      .filter((manager) => manager.officeUuids.includes(this.data.office.id))
      .map((manager) => ({
        value: manager.id,
        label: manager.displayName,
        userId: manager.id,
      })),
  );

  protected readonly clientWarnings = computed(() => {
    const value = this.model();
    const warnings: string[] = [];
    const duration = Number(value.duration);
    const [hour, minute] = value.time.split(':').map(Number);
    const endMinutes = hour * 60 + minute + duration;
    const date = new Date(`${value.date}T12:00:00Z`);
    if (date.getUTCDay() === 0 || hour * 60 + minute < 9 * 60 || endMinutes > 19 * 60) {
      warnings.push(this.i18n.t('calendar.warningOutside'));
    }
    const currentStart = `${value.date}T${value.time}`;
    const currentEndMinutes = hour * 60 + minute + duration;
    const overlaps = (this.data.appointments ?? []).some((item) => {
      if (
        item.id === this.data.appointment?.id ||
        item.status !== 'scheduled' ||
        item.responsibleManager?.id !== value.managerId
      ) {
        return false;
      }
      const parts = officeDateTimeParts(item.startsAt, this.data.office.timezone_name ?? 'UTC');
      if (parts.date !== value.date) return false;
      const end = officeDateTimeParts(item.endsAt, this.data.office.timezone_name ?? 'UTC');
      const [startHour, startMinute] = parts.time.split(':').map(Number);
      const [endHour, endMinute] = end.time.split(':').map(Number);
      const existingStart = startHour * 60 + startMinute;
      const existingEnd = endHour * 60 + endMinute;
      return hour * 60 + minute < existingEnd && currentEndMinutes > existingStart;
    });
    if (overlaps && currentStart) warnings.unshift(this.i18n.t('calendar.warningOverlap'));
    return warnings;
  });

  protected async searchLeads(value: string): Promise<void> {
    this.leadSearch.set(value);
    this.selectedLead.set(null);
    const query = value.trim();
    const sequence = ++this.searchSequence;
    if (query.length < 2) {
      this.leadResults.set([]);
      return;
    }
    this.searchingLeads.set(true);
    try {
      const results = await this.leads.list({
        officeId: this.data.office.id,
        search: query,
        archived: 'active',
        limit: 12,
      });
      if (sequence === this.searchSequence) {
        this.leadResults.set(
          results.filter(
            (lead) =>
              lead.clientStatus !== 'closed_lost' && lead.clientStatus !== 'contract_signed',
          ),
        );
      }
    } finally {
      if (sequence === this.searchSequence) this.searchingLeads.set(false);
    }
  }

  protected selectLead(lead: MockLead): void {
    this.selectedLead.set(lead);
    this.leadResults.set([]);
    this.leadSearch.set('');
    if (lead.assignedToId) {
      this.model.update((value) => ({ ...value, managerId: lead.assignedToId! }));
    }
  }

  protected clearLead(): void {
    this.selectedLead.set(null);
    this.leadSearch.set('');
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set('');
    await submit(this.appointmentForm, async () => {
      const lead = this.selectedLead();
      if (!lead) return;
      const value = this.model();
      try {
        const appointment = this.data.appointment
          ? await this.appointments.update(
              this.data.appointment.id,
              this.data.appointment.version,
              {
                startsAtLocal: `${value.date}T${value.time}`,
                durationMinutes: Number(value.duration),
                responsibleManagerId: value.managerId,
                comment: value.comment.trim(),
              },
            )
          : await this.appointments.create({
              leadId: lead.id,
              startsAtLocal: `${value.date}T${value.time}`,
              durationMinutes: Number(value.duration),
              responsibleManagerId: value.managerId,
              comment: value.comment.trim(),
            });
        this.dialogRef.close({ kind: 'saved', appointment });
      } catch (error) {
        this.handleError(error);
      }
    });
  }

  protected async setStatus(status: 'visited' | 'no_show' | 'canceled'): Promise<void> {
    const current = this.data.appointment;
    if (!current || this.appointmentForm().submitting()) return;
    this.error.set('');
    try {
      const appointment = await this.appointments.update(current.id, current.version, { status });
      this.dialogRef.close({ kind: 'saved', appointment });
    } catch (error) {
      this.handleError(error);
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private handleError(error: unknown): void {
    if (error instanceof KolssApiError && error.code === 'version_conflict') {
      this.error.set(this.i18n.t('calendar.stale'));
      this.dialogRef.close({ kind: 'stale' });
      return;
    }
    if (error instanceof KolssApiError) {
      const key = {
        active_appointment_exists: 'calendar.activeExists',
        appointment_terminal: 'calendar.terminal',
        office_forbidden: 'calendar.officeForbidden',
      }[error.code] as
        'calendar.activeExists' | 'calendar.terminal' | 'calendar.officeForbidden' | undefined;
      if (key) {
        this.error.set(this.i18n.t(key));
        return;
      }
    }
    this.error.set(error instanceof Error ? error.message : this.i18n.t('calendar.saveFailed'));
  }

  private initialModel(): AppointmentFormModel {
    const appointment = this.data.appointment;
    const dateTime = appointment
      ? officeDateTimeParts(appointment.startsAt, this.data.office.timezone_name ?? 'UTC')
      : null;
    const duration = appointment
      ? Math.round(
          (new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime()) /
            60_000,
        )
      : 60;
    const selectedLead = this.selectedLead();
    const currentUserId = this.auth.sessionContext()?.user.id ?? '';
    return {
      date: dateTime?.date ?? this.data.date ?? '',
      time: dateTime?.time ?? this.data.time ?? '10:00',
      duration: String(duration),
      managerId:
        appointment?.responsibleManager?.id ??
        selectedLead?.assignedToId ??
        this.data.defaultManagerId ??
        currentUserId,
      comment: appointment?.comment ?? '',
    };
  }

  private leadFromAppointment(appointment?: Appointment): MockLead | null {
    if (!appointment) return null;
    return {
      id: appointment.lead.id,
      name: appointment.lead.name,
      phone: appointment.lead.phone,
      officeCode: appointment.office.code as MockLead['officeCode'],
      assignedToId: appointment.responsibleManager?.id ?? null,
      clientStatus: 'showroom_invited',
    } as MockLead;
  }
}
