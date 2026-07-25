import { computed, inject, signal } from '@angular/core';
import { Component } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';

import { KolssApiError } from '@core/api/generated/kolss-api.client';
import type { Appointment } from '@core/api/generated/kolss-api.types';
import { AuthService } from '@core/auth/auth.service';
import { I18nService } from '@core/i18n/i18n.service';
import { isOfficeMemberRole } from '@core/roles/roles';
import type { Office } from '@models/database';
import type { Lead } from '@domain/lead.types';
import { AppointmentsService, officeDateTimeParts } from '@services/appointments.service';
import { LeadsService } from '@services/leads.service';
import type { CrmEmployee } from '@services/users.service';
import { UiButton } from '@ui/button/ui-button';
import { UiSelect, type UiSelectOption } from '@ui/form/ui-select';
import { UiTextField } from '@ui/form/ui-text-field';
import { UiTextarea } from '@ui/form/ui-textarea';
import { UiIcon } from '@ui/icon/ui-icon';
import { UiDialogService } from '@ui/dialog/ui-dialog';

export interface AppointmentDrawerData {
  readonly office: Office;
  readonly managers: readonly CrmEmployee[];
  readonly appointment?: Appointment;
  readonly lead?: Lead;
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
  imports: [FormField, RouterLink, UiButton, UiIcon, UiSelect, UiTextField, UiTextarea],
  templateUrl: './appointment-drawer.html',
  styleUrl: './appointment-drawer.scss',
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
  protected readonly rebook = signal(false);
  protected readonly searchingLeads = signal(false);
  protected readonly leadSearch = signal('');
  protected readonly leadResults = signal<readonly Lead[]>([]);
  protected readonly selectedLead = signal<Lead | null>(
    this.data.lead ?? this.leadFromAppointment(this.data.appointment),
  );
  protected readonly isTerminal =
    this.data.appointment != null && this.data.appointment.status !== 'scheduled';
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
      .filter(
        (manager) =>
          manager.status === 'active' &&
          isOfficeMemberRole(manager.role) &&
          manager.officeUuids.includes(this.data.office.id),
      )
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

  protected selectLead(lead: Lead): void {
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

  protected startRebook(): void {
    this.rebook.set(true);
    this.error.set('');
    this.model.update((value) => ({ ...value, time: '10:00', comment: '' }));
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set('');
    await submit(this.appointmentForm, async () => {
      const lead = this.selectedLead();
      if (!lead) return;
      const value = this.model();
      const isCreate = !this.data.appointment || this.rebook();
      try {
        const appointment = isCreate
          ? await this.appointments.create({
              leadId: lead.id,
              startsAtLocal: `${value.date}T${value.time}`,
              durationMinutes: Number(value.duration),
              responsibleManagerId: value.managerId,
              comment: value.comment.trim(),
            })
          : await this.appointments.update(
              this.data.appointment!.id,
              this.data.appointment!.version,
              {
                startsAtLocal: `${value.date}T${value.time}`,
                durationMinutes: Number(value.duration),
                responsibleManagerId: value.managerId,
                comment: value.comment.trim(),
              },
            );
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

  protected appointmentStatusLabel(status: Appointment['status']): string {
    switch (status) {
      case 'visited':
        return this.i18n.t('calendar.visited');
      case 'no_show':
        return this.i18n.t('calendar.noShow');
      case 'canceled':
        return this.i18n.t('calendar.canceled');
      case 'rescheduled':
        return this.i18n.t('calendar.rescheduled');
      case 'scheduled':
        return this.i18n.t('calendar.scheduled');
    }
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

  private leadFromAppointment(appointment?: Appointment): Lead | null {
    if (!appointment) return null;
    return {
      id: appointment.lead.id,
      name: appointment.lead.name,
      phone: appointment.lead.phone,
      officeCode: appointment.office.code as Lead['officeCode'],
      assignedToId: appointment.responsibleManager?.id ?? null,
      clientStatus: 'showroom_invited',
    } as Lead;
  }
}

export function openAppointmentDrawer(dialogs: UiDialogService, data: AppointmentDrawerData) {
  return dialogs.open<
    AppointmentDrawer,
    AppointmentDrawerData,
    AppointmentDrawerResult | undefined
  >(AppointmentDrawer, {
    data,
    position: { right: '0', top: '0' },
    width: 'min(31rem, 100vw)',
    maxWidth: '100vw',
    height: '100dvh',
    maxHeight: '100dvh',
    panelClass: ['ui-dialog-panel', 'appointment-drawer-panel'],
  });
}
