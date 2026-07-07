import { computed, Service, signal } from '@angular/core';

import {
  CRM_MOCK_ACTOR_ID,
  CRM_MOCK_EMPLOYEES,
  CRM_MOCK_LEADS,
  CRM_MOCK_NOW,
  CRM_MOCK_OFFICES,
} from './crm-mock.data';
import {
  calculateFunnel,
  CLOSE_REASON_LABELS,
  employeeName,
  filterLeadsByOffice,
  validateCloseLead,
  validateSuccessfulLead,
} from './crm-mock.helpers';
import type {
  CloseLeadPayload,
  FunnelStage,
  LocaleCode,
  MockEmployee,
  MockLead,
  OfficeFilter,
  SuccessfulLeadPayload,
} from './crm-mock.types';

@Service()
export class CrmMockService {
  private readonly leadsSignal = signal<readonly MockLead[]>(CRM_MOCK_LEADS);
  private readonly officeFilterSignal = signal<OfficeFilter>('all');
  private readonly localeSignal = signal<LocaleCode>('uk');

  readonly offices = signal(CRM_MOCK_OFFICES).asReadonly();
  readonly employees = signal(CRM_MOCK_EMPLOYEES).asReadonly();
  readonly leads = this.leadsSignal.asReadonly();
  readonly officeFilter = this.officeFilterSignal.asReadonly();
  readonly locale = this.localeSignal.asReadonly();
  readonly currentEmployee = computed(
    () =>
      this.employees().find((employee) => employee.id === CRM_MOCK_ACTOR_ID) ?? this.employees()[0],
  );
  readonly visibleLeads = computed(() =>
    filterLeadsByOffice(this.leadsSignal(), this.officeFilterSignal()),
  );
  readonly funnel40Days = computed(() => calculateFunnel(this.visibleLeads(), 40));

  setOfficeFilter(filter: OfficeFilter): void {
    this.officeFilterSignal.set(filter);
  }

  setLocale(locale: LocaleCode): void {
    this.localeSignal.set(locale);
  }

  leadById(id: string): MockLead | undefined {
    return this.leadsSignal().find((lead) => lead.id === id);
  }

  employeeById(id: string): MockEmployee | undefined {
    return this.employees().find((employee) => employee.id === id);
  }

  employeeName(employeeId: string | null): string {
    return employeeName(this.employees(), employeeId);
  }

  funnel(periodDays: number): readonly FunnelStage[] {
    return calculateFunnel(this.visibleLeads(), periodDays);
  }

  takeLead(leadId: string): void {
    const actor = this.currentEmployee();
    this.updateLead(leadId, (lead) => {
      if (lead.assignedToId || lead.workflowStatus !== 'new') return lead;
      return {
        ...lead,
        leadStatus: 'in_progress',
        workflowStatus: 'taken',
        assignedToId: actor.id,
        firstManagerId: actor.id,
        lastComment: `${actor.displayName} взяла лід у роботу.`,
        lastActivityAt: CRM_MOCK_NOW,
        events: [
          this.createEvent(
            'taken',
            'Лід взято в роботу',
            `${actor.displayName} першою взяла заявку.`,
          ),
          ...lead.events,
        ],
      };
    });
  }

  recordFirstCall(leadId: string, result: string, comment: string): string | null {
    if (!result.trim()) return 'Оберіть результат першого дзвінка.';
    if (!comment.trim()) return 'Додайте короткий коментар до дзвінка.';

    this.updateLead(leadId, (lead) => ({
      ...lead,
      leadStatus: 'in_progress',
      workflowStatus: 'first_call_done',
      firstCall: {
        date: CRM_MOCK_NOW,
        result,
        comment,
      },
      lastComment: comment,
      lastActivityAt: CRM_MOCK_NOW,
      events: [
        this.createEvent('first_call', 'Перший дзвінок зафіксовано', `${result}. ${comment}`),
        ...lead.events,
      ],
    }));
    return null;
  }

  scheduleVisit(leadId: string, scheduledAt: string, comment: string): string | null {
    if (!scheduledAt.trim()) return 'Вкажіть дату візиту.';

    this.updateLead(leadId, (lead) => ({
      ...lead,
      leadStatus: 'in_progress',
      workflowStatus: 'visit_scheduled',
      visit: {
        status: 'scheduled',
        scheduledAt,
        comment,
      },
      callbackDueAt: null,
      lastComment: comment || 'Візит заплановано.',
      lastActivityAt: CRM_MOCK_NOW,
      events: [
        this.createEvent(
          'visit_scheduled',
          'Візит заплановано',
          comment || 'Клієнта очікують у салоні.',
        ),
        ...lead.events,
      ],
    }));
    return null;
  }

  rescheduleVisit(leadId: string, scheduledAt: string, comment: string): string | null {
    if (!scheduledAt.trim()) return 'Вкажіть нову дату візиту.';
    if (!comment.trim()) return 'Вкажіть причину або коментар до перенесення.';

    this.updateLead(leadId, (lead) => ({
      ...lead,
      leadStatus: 'in_progress',
      workflowStatus: 'visit_rescheduled',
      visit: {
        status: 'rescheduled',
        scheduledAt,
        comment,
      },
      lastComment: comment,
      lastActivityAt: CRM_MOCK_NOW,
      events: [this.createEvent('visit_rescheduled', 'Візит перенесено', comment), ...lead.events],
    }));
    return null;
  }

  completeVisit(leadId: string, comment: string): string | null {
    if (!comment.trim()) return 'Додайте короткий результат візиту.';

    this.updateLead(leadId, (lead) => ({
      ...lead,
      leadStatus: 'in_progress',
      workflowStatus: 'visit_completed',
      visit: {
        status: 'completed',
        scheduledAt: lead.visit?.scheduledAt ?? CRM_MOCK_NOW,
        completedAt: CRM_MOCK_NOW,
        comment,
      },
      lastComment: comment,
      lastActivityAt: CRM_MOCK_NOW,
      events: [this.createEvent('visit_completed', 'Візит відбувся', comment), ...lead.events],
    }));
    return null;
  }

  addComment(leadId: string, comment: string): string | null {
    if (!comment.trim()) return 'Коментар не може бути порожнім.';

    this.updateLead(leadId, (lead) => ({
      ...lead,
      lastComment: comment,
      lastActivityAt: CRM_MOCK_NOW,
      events: [this.createEvent('comment', 'Коментар', comment), ...lead.events],
    }));
    return null;
  }

  closeLead(leadId: string, payload: CloseLeadPayload): string | null {
    const error = validateCloseLead(payload);
    if (error) return error;

    this.updateLead(leadId, (lead) => ({
      ...lead,
      leadStatus: 'failed',
      workflowStatus: 'closed',
      close: {
        ...payload,
        closedAt: CRM_MOCK_NOW,
        actorId: this.currentEmployee().id,
      },
      callbackDueAt: null,
      lastComment: payload.comment || CLOSE_REASON_LABELS[payload.reason],
      lastActivityAt: CRM_MOCK_NOW,
      events: [
        this.createEvent(
          'closed',
          'Лід закрито',
          `${CLOSE_REASON_LABELS[payload.reason]}${payload.comment ? `. ${payload.comment}` : ''}`,
        ),
        ...lead.events,
      ],
    }));
    return null;
  }

  markSuccessful(leadId: string, payload: SuccessfulLeadPayload): string | null {
    const error = validateSuccessfulLead(payload);
    if (error) return error;

    this.updateLead(leadId, (lead) => ({
      ...lead,
      leadStatus: 'converted',
      workflowStatus: 'successful',
      contract: {
        ...payload,
        signedAt: CRM_MOCK_NOW,
      },
      callbackDueAt: null,
      lastComment: payload.comment || `Договір ${payload.contractNumber} заключений.`,
      lastActivityAt: CRM_MOCK_NOW,
      events: [
        this.createEvent(
          'successful',
          'Договір заключений',
          `${payload.contractNumber} на суму ${payload.amount.toLocaleString('uk-UA')} EUR.`,
        ),
        ...lead.events,
      ],
    }));
    return null;
  }

  reset(): void {
    this.leadsSignal.set(CRM_MOCK_LEADS);
    this.officeFilterSignal.set('all');
    this.localeSignal.set('uk');
  }

  private updateLead(leadId: string, updater: (lead: MockLead) => MockLead): void {
    this.leadsSignal.update((leads) =>
      leads.map((lead) => (lead.id === leadId ? updater(lead) : lead)),
    );
  }

  private createEvent(type: MockLead['events'][number]['type'], title: string, body: string) {
    return {
      id: `evt-${type}-${Date.now()}`,
      type,
      title,
      body,
      actorId: this.currentEmployee().id,
      occurredAt: CRM_MOCK_NOW,
    };
  }
}
