import type {
  ClientFacetsResponse,
  ClientListResponse,
  ClientSummary,
} from '@core/api/generated/kolss-api.types';
import { formatPhoneDisplay } from '@core/phone/phone';
import { isOfficeId } from '@core/office/office.config';
import type { OfficeId } from '@domain/office.types';
import type { V2ClientFacets, V2ClientListItem, V2ClientListPage } from './client.types';

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
