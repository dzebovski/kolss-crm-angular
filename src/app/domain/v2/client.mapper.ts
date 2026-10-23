import type {
  Client,
  ClientContractValue,
  ClientFacetsResponse,
  ClientLeadRow,
  ClientListResponse,
  ClientProjectRow,
  ClientSummary,
} from '@core/api/generated/kolss-api.types';
import { formatPhoneDisplay } from '@core/phone/phone';
import { isOfficeId } from '@core/office/office.config';
import type { OfficeId } from '@domain/office.types';
import { v2PercentOf } from './project-money';
import type { V2LeadProduct } from './lead-card.types';
import type { V2LeadChannel, V2LeadDisplayStatus } from './lead-view.types';
import type { V2Money } from './project.types';
import type {
  V2Client,
  V2ClientFacets,
  V2ClientLanguage,
  V2ClientLeadRow,
  V2ClientListItem,
  V2ClientListPage,
  V2ClientProjectRow,
} from './client.types';

const FALLBACK_OFFICE: OfficeId = 'warsaw';

export function toV2ClientListItem(client: ClientSummary): V2ClientListItem {
  const officeId = isOfficeId(client.office.code) ? client.office.code : FALLBACK_OFFICE;
  return {
    id: client.id,
    code: client.code.toUpperCase(),
    name: client.name,
    phone: formatPhoneDisplay(client.phone, officeId),
    officeId,
    createdAt: client.createdAt,
    leadsCount: client.leadsCount,
    projectsCount: client.projectsCount,
    returning: client.leadsCount > 1,
    managerName: client.manager?.name ?? null,
  };
}

export function toV2ClientListPage(response: ClientListResponse): V2ClientListPage {
  return {
    items: response.items.map(toV2ClientListItem),
    nextCursor: response.nextCursor || null,
  };
}

export function toV2ClientFacets(facets: ClientFacetsResponse): V2ClientFacets {
  return {
    total: facets.total,
    filter: {
      all: facets.filter.all,
      with_projects: facets.filter.with_projects,
      leads_only: facets.filter.leads_only,
    },
  };
}

const LEAD_STATUSES: readonly V2LeadDisplayStatus[] = [
  'new',
  'later',
  'noanswer',
  'success',
  'thinking',
  'invited',
  'lost',
  'project',
  'measurement_scheduled',
  'calculation_in_progress',
  'postponed',
  'contract_signed',
];
const PRODUCTS: readonly V2LeadProduct[] = [
  'kitchen',
  'wardrobe',
  'furniture',
  'bathroom',
  'hallway',
  'other',
];
const CHANNELS: readonly V2LeadChannel[] = [
  'referral',
  'phone',
  'office',
  'website',
  'meta_ads',
  'google_ads',
  'other',
];
const LANGUAGES: readonly V2ClientLanguage[] = ['pl', 'uk', 'en', 'ru'];

function pick<T extends string>(values: readonly T[], value: string | null): T | null {
  return values.find((candidate) => candidate === value) ?? null;
}

function toProducts(tags: readonly string[]): V2LeadProduct[] {
  return tags.flatMap((tag) => pick(PRODUCTS, tag) ?? []);
}

function toLeadRow(row: ClientLeadRow): V2ClientLeadRow {
  return {
    id: row.id,
    code: row.code.toUpperCase(),
    createdAt: row.createdAt,
    status: pick(LEAD_STATUSES, row.v2Status) ?? 'new',
    products: toProducts(row.products),
    managerName: row.manager?.name ?? null,
    projectId: row.projectId,
  };
}

function toProjectRow(row: ClientProjectRow): V2ClientProjectRow {
  return {
    id: row.id,
    leadCode: row.code.toUpperCase(),
    products: toProducts(row.title),
    status: row.status,
    createdAt: row.createdAt,
    managerName: row.manager?.name ?? null,
    contract: row.contract
      ? {
          total: { amount: row.contract.totalAmount, currency: row.contract.currency },
          percentPaid: v2PercentOf(row.contract.paidAmount, row.contract.totalAmount),
        }
      : null,
  };
}

function toMoney(amount: number, value: ClientContractValue): V2Money {
  return { amount, currency: value.currency };
}

export function toV2Client(client: Client): V2Client {
  const base = toV2ClientListItem(client);
  const closed: readonly string[] = ['completed', 'cancelled'];
  return {
    ...base,
    rawPhone: client.phone,
    secondPhone: client.secondPhone,
    secondPhoneDisplay: client.secondPhone
      ? formatPhoneDisplay(client.secondPhone, base.officeId)
      : null,
    email: client.email,
    address: client.address,
    language: pick(LANGUAGES, client.language),
    about: client.about,
    version: client.version,
    firstChannel: pick(CHANNELS, client.firstChannel),
    openLeadsCount: client.leads.filter((lead) => lead.projectId === null).length,
    activeProjectsCount: client.projects.filter((project) => !closed.includes(project.status))
      .length,
    contractValue: client.stats.contractValue.map((value) => ({
      total: toMoney(value.total, value),
      paid: toMoney(value.paid, value),
      remaining: toMoney(value.remaining, value),
    })),
    leads: client.leads.map(toLeadRow),
    projects: client.projects.map(toProjectRow),
    duplicates: client.duplicates.map((duplicate) => ({
      ...toV2ClientListItem(duplicate),
      matchedBy: duplicate.matchedBy,
      email: duplicate.email,
    })),
    redirectedFromCode: client.redirectedFrom?.code.toUpperCase() ?? null,
    canEdit: client.permissions.canEdit,
    canMerge: client.permissions.canMerge,
  };
}
