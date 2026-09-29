import type {
  Project,
  ProjectContract,
  ProjectEvent,
  ProjectFacetsResponse,
  ProjectFileRef,
  ProjectListItem,
  ProjectPayment,
  ProjectPerson,
} from '@core/api/generated/kolss-api.types';
import { v2PercentOf } from './project-money';
import { V2_PROJECT_STATUSES } from './project-status';
import type {
  V2Money,
  V2Project,
  V2ProjectContract,
  V2ProjectFacets,
  V2ProjectFile,
  V2ProjectListItem,
  V2ProjectPayment,
  V2ProjectPerson,
  V2ProjectSchedule,
  V2ProjectStatus,
  V2ProjectTimelineEntry,
} from './project.types';

function toPerson(person: ProjectPerson | null): V2ProjectPerson | null {
  return person ? { id: person.id, name: person.name } : null;
}

function toFile(file: ProjectFileRef | null): V2ProjectFile | null {
  return file ? { id: file.id, fileName: file.fileName, sizeBytes: file.sizeBytes } : null;
}

function toSchedule(date: string | null, time: string | null): V2ProjectSchedule | null {
  return date ? { date, time: time || null } : null;
}

function toStatus(value: string | null): V2ProjectStatus | null {
  return V2_PROJECT_STATUSES.find((status) => status === value) ?? null;
}

function toContract(contract: ProjectContract): V2ProjectContract {
  const money = (amount: number): V2Money => ({ amount, currency: contract.currency });
  return {
    id: contract.id,
    number: contract.number,
    signedOn: contract.signedOn,
    total: money(contract.totalAmount),
    paid: money(contract.paidAmount),
    remaining: money(contract.remainingAmount),
    percentPaid: v2PercentOf(contract.paidAmount, contract.totalAmount),
    fullyPaid: contract.remainingAmount <= 0,
    file: toFile(contract.file),
  };
}

function toPayment(payment: ProjectPayment, contract: ProjectContract): V2ProjectPayment {
  return {
    id: payment.id,
    amount: { amount: payment.amount, currency: contract.currency },
    paidOn: payment.paidOn,
    note: payment.note,
    createdAt: payment.createdAt,
    createdByName: payment.createdByName,
    file: toFile(payment.file),
    sharePercent: v2PercentOf(payment.amount, contract.totalAmount),
  };
}

export function toV2Project(project: Project): V2Project {
  const contract = project.contract;
  return {
    id: project.id,
    leadId: project.leadId,
    officeId: project.officeId,
    code: project.code,
    clientName: project.client.name,
    client: {
      phone: project.client.phone,
      email: project.client.email,
      cityRegion: project.client.cityRegion,
    },
    status: project.status,
    projectType: project.projectType,
    schedule: toSchedule(project.eventDate, project.eventTime),
    stageDetails: project.statusDetails,
    manager: toPerson(project.manager),
    createdAt: project.createdAt,
    createdByName: project.createdByName,
    statusChangedAt: project.statusChangedAt,
    lastActivityAt: project.lastActivityAt,
    cancellation: project.cancellation
      ? {
          cancelledAt: project.cancellation.cancelledAt,
          cancelledByName: project.cancellation.cancelledByName,
          reasons: project.cancellation.reasons,
          comment: project.cancellation.comment,
          previousStatus: toStatus(project.cancellation.statusBeforeCancel),
        }
      : null,
    contract: contract ? toContract(contract) : null,
    // Payments exist only with a contract; the currency comes from it.
    payments: contract ? project.payments.map((payment) => toPayment(payment, contract)) : [],
    canEdit: project.permissions.canEdit,
  };
}

export function toV2ProjectListItem(item: ProjectListItem): V2ProjectListItem {
  return {
    id: item.id,
    leadId: item.leadId,
    code: item.code,
    clientName: item.clientName,
    products: item.products,
    status: item.status,
    projectType: item.projectType,
    schedule: toSchedule(item.eventDate, item.eventTime),
    manager: toPerson(item.manager),
    createdAt: item.createdAt,
    lastComment: item.lastComment ? { text: item.lastComment.text, at: item.lastComment.at } : null,
  };
}

export function toV2ProjectFacets(facets: ProjectFacetsResponse): V2ProjectFacets {
  return {
    total: facets.total,
    status: Object.fromEntries(
      V2_PROJECT_STATUSES.map((status) => [status, facets.status[status] ?? 0]),
    ) as Record<V2ProjectStatus, number>,
  };
}

export function toV2ProjectTimelineEntry(event: ProjectEvent): V2ProjectTimelineEntry {
  return {
    id: event.id,
    type: event.type,
    actor: toPerson(event.actor),
    oldValue: event.oldValue,
    newValue: event.newValue,
    comment: event.comment,
    createdAt: event.createdAt,
  };
}
