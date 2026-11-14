import type {
  Project,
  ProjectBoard,
  ProjectDocument,
  ProjectEvent,
  ProjectFacetsResponse,
  ProjectFileRef,
  ProjectListItem,
  ProjectMoney,
  ProjectPayment,
  ProjectPerson,
} from '@core/api/generated/kolss-api.types';
import { V2_PROJECT_STATUSES } from './project-status';
import type {
  V2Money,
  V2Project,
  V2ProjectBoard,
  V2ProjectDocument,
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

function toMoney(money: ProjectMoney): V2Money {
  return { amount: money.amount, currency: money.currency };
}

function toPayment(payment: ProjectPayment): V2ProjectPayment {
  return {
    id: payment.id,
    amount: { amount: payment.amount, currency: payment.currency },
    paidOn: payment.paidOn,
    basis: payment.basis,
    note: payment.note,
    createdAt: payment.createdAt,
    createdByName: payment.createdByName,
    file: toFile(payment.file),
  };
}

function toDocument(document: ProjectDocument): V2ProjectDocument {
  return {
    id: document.id,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    createdAt: document.createdAt,
    uploadedBy: toPerson(document.uploadedBy),
  };
}

export function toV2Project(project: Project): V2Project {
  return {
    id: project.id,
    leadId: project.leadId,
    clientId: project.clientId,
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
    manager: toPerson(project.manager),
    designer: toPerson(project.designer),
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
    description: project.description?.trim() || null,
    estimate: project.estimate ? toMoney(project.estimate) : null,
    paidTotals: project.paidTotals.map(toMoney),
    payments: project.payments.map(toPayment),
    documents: project.documents.map(toDocument),
    canEdit: project.permissions.canEdit,
  };
}

export function toV2ProjectListItem(item: ProjectListItem): V2ProjectListItem {
  return {
    id: item.id,
    leadId: item.leadId,
    clientId: item.clientId,
    code: item.code,
    clientName: item.clientName,
    products: item.products,
    status: item.status,
    projectType: item.projectType,
    schedule: toSchedule(item.eventDate, item.eventTime),
    manager: toPerson(item.manager),
    designer: toPerson(item.designer),
    estimate: item.estimate ? toMoney(item.estimate) : null,
    paidTotals: item.paidTotals.map(toMoney),
    createdAt: item.createdAt,
    lastComment: item.lastComment ? { text: item.lastComment.text, at: item.lastComment.at } : null,
  };
}

export function toV2ProjectBoard(board: ProjectBoard): V2ProjectBoard {
  return {
    total: board.total,
    completedCount: board.completedCount,
    cancelledCount: board.cancelledCount,
    columns: board.columns.map((column) => ({
      status: column.status,
      count: column.count,
      items: column.items.map(toV2ProjectListItem),
      nextCursor: column.nextCursor || null,
    })),
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
