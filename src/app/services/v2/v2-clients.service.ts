import { inject, Service } from '@angular/core';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import type { ClientListQuery } from '@core/api/generated/kolss-api.types';
import { toV2ClientFacets, toV2ClientListPage } from '@domain/v2/client.mapper';
import type { V2ClientFacets, V2ClientListPage } from '@domain/v2/client.types';

/** 30 clients per request, "Show more" appends the next page (owner decision 09-29). */
export const V2_CLIENTS_PAGE_SIZE = 30;

/**
 * Data service of CRM v2 clients: every `/v1/clients*` endpoint, returning view models.
 * Components never call `KolssApiClient` directly.
 */
@Service()
export class V2ClientsService {
  private readonly api = inject(KolssApiClient);

  async list(query: Omit<ClientListQuery, 'limit'>, cursor: string): Promise<V2ClientListPage> {
    return toV2ClientListPage(
      await this.api.listClients({
        ...query,
        cursor: cursor || undefined,
        limit: V2_CLIENTS_PAGE_SIZE,
      }),
    );
  }

  /** `total` with every filter; the chip counts ignore the chip filter itself. */
  async facets(query: Omit<ClientListQuery, 'limit' | 'cursor'>): Promise<V2ClientFacets> {
    return toV2ClientFacets(await this.api.clientFacets(query));
  }
}
