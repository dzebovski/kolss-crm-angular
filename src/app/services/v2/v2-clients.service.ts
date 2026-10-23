import { inject, Service } from '@angular/core';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import type {
  ClientListQuery,
  ClientMatchQuery,
  MergeClientsRequest,
  UpdateClientRequest,
} from '@core/api/generated/kolss-api.types';
import {
  toV2Client,
  toV2ClientFacets,
  toV2ClientListItem,
  toV2ClientListPage,
} from '@domain/v2/client.mapper';
import type {
  V2Client,
  V2ClientFacets,
  V2ClientListItem,
  V2ClientListPage,
} from '@domain/v2/client.types';

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

  /** A merged-away id returns the surviving client with `redirectedFromCode` set. */
  async get(id: string): Promise<V2Client> {
    return toV2Client(await this.api.client(id));
  }

  /** Partial update; `version` is the loaded client's (409 `version_conflict` when stale). */
  async update(id: string, body: UpdateClientRequest, version: number): Promise<V2Client> {
    return toV2Client(await this.api.updateClient(id, body, version));
  }

  /**
   * Irreversible. The older client survives whichever id is in the path; returns the survivor.
   * Pass the same key on a retry so the merge cannot run twice.
   */
  async merge(id: string, body: MergeClientsRequest, idempotencyKey: string): Promise<V2Client> {
    return toV2Client(await this.api.mergeClients(id, body, idempotencyKey));
  }

  /** Returning-client hint of Create lead; null when nothing matches. */
  async match(query: ClientMatchQuery): Promise<V2ClientMatch | null> {
    const { match } = await this.api.matchClient(query);
    return match ? { matchedBy: match.matchedBy, client: toV2ClientListItem(match.client) } : null;
  }
}

export interface V2ClientMatch {
  readonly matchedBy: 'phone' | 'email';
  readonly client: V2ClientListItem;
}
