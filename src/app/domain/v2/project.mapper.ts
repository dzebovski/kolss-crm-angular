import type {
  Project,
  ProjectBoard,
  ProjectContract,
  ProjectEstimate,
  ProjectEstimateLine,
  ProjectEvent,
  ProjectFacetsResponse,
  ProjectFileRef,
  ProjectListItem,
  ProjectMoney,
  ProjectPayment,
  ProjectPerson,
} from '@core/api/generated/kolss-api.types';
import { V2_ESTIMATE_LINES, v2PercentOf } from './project-money';
import { V2_PROJECT_STATUSES } from './project-status';
import type {
  V2EstimateLine,
  V2EstimateLineKey,
  V2Money,
  V2Project,
  V2ProjectBoard,
  V2ProjectContract,
  V2ProjectEstimate,
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

function toContract(contract: ProjectContract): V2ProjectContract {
  const money = (amount: number): V2Money => ({ amount, currency: contract.currency });
  const covered = contract.paidAmount + contract.creditedAmount;
  return {
    id: contract.id,
    kind: contract.kind,
    number: contract.number,
    signedOn: contract.signedOn,
    total: money(contract.totalAmount),
    paid: money(contract.paidAmount),
    credited: money(contract.creditedAmount),
    remaining: money(contract.remainingAmount),
    target50: contract.target50Amount === null ? null : money(contract.target50Amount),
    percentPaid: v2PercentOf(covered, contract.totalAmount),
    fullyPaid: contract.remainingAmount <= 0,
    target50Reached: contract.target50Amount !== null && covered >= contract.target50Amount,
    file: toFile(contract.file),
  };
}

function toPayment(payment: ProjectPayment, contract: ProjectContract): V2ProjectPayment {
  return {
    id: payment.id,
    contractId: payment.contractId,
    contractKind: payment.contractKind,
    amount: { amount: payment.amount, currency: contract.currency },
    paidOn: payment.paidOn,
    note: payment.note,
    createdAt: payment.createdAt,
    createdByName: payment.createdByName,
    file: toFile(payment.file),
    sharePercent: v2PercentOf(payment.amount, contract.totalAmount),
  };
}

function toEstimateLine(line: ProjectEstimateLine | null): V2EstimateLine | null {
  return line ? { money: { amount: line.amount, currency: line.currency }, note: line.note } : null;
}

function toEstimate(estimate: ProjectEstimate): V2ProjectEstimate {
  const lines = Object.fromEntries(
    V2_ESTIMATE_LINES.map((key) => [key, toEstimateLine(estimate.lines[key])]),
  ) as Record<V2EstimateLineKey, V2EstimateLine | null>;
  return { lines, totals: estimate.totals.map(toMoney), locked: estimate.locked };
}

export function toV2Project(project: Project): V2Project {
  const { intro, main } = project.contracts;
  const payments: V2ProjectPayment[] = [];
  for (const payment of project.payments) {
    // A payment belongs to one contract; the currency comes from it.
    const contract = [intro, main].find((candidate) => candidate?.id === payment.contractId);
    if (contract) payments.push(toPayment(payment, contract));
  }
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
    stageDetails: project.statusDetails,
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
    estimate: toEstimate(project.estimate),
    introDefault: project.introDefault ? toMoney(project.introDefault) : null,
    contracts: {
      intro: intro ? toContract(intro) : null,
      main: main ? toContract(main) : null,
    },
    payments,
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
    estimateTotals: item.estimateTotals.map(toMoney),
    createdAt: item.createdAt,
    lastComment: item.lastComment ? { text: item.lastComment.text, at: item.lastComment.at } : null,
  };
}

export function toV2ProjectBoard(board: ProjectBoard): V2ProjectBoard {
  return {
    total: board.total,
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
