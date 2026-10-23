import type { OfficeId } from '@domain/office.types';

/**
 * CRM v2 client view models (API 2.35.0). Screens take these, not the raw DTOs. Dates stay ISO
 * timestamps; the UI formats them with `date-format.ts`.
 */

export type V2ClientFilter = 'all' | 'with_projects' | 'leads_only';

/** A row of the Clients list (also the shape of a duplicate candidate's summary). */
export interface V2ClientListItem {
  readonly id: string;
  /** The code of the client's first lead, e.g. `W0231`. */
  readonly code: string;
  readonly name: string;
  /** Display form (`+48 601 334 812`); `—` without a phone. */
  readonly phone: string;
  readonly officeId: OfficeId;
  /** "Client since". */
  readonly createdAt: string;
  readonly leadsCount: number;
  readonly projectsCount: number;
  /** More than one active lead: the client came back with a new request. */
  readonly returning: boolean;
  /** Manager of the latest project, otherwise of the latest lead. */
  readonly managerName: string | null;
}

export interface V2ClientListPage {
  readonly items: readonly V2ClientListItem[];
  /** Pass to the next `list` call; null on the last page. */
  readonly nextCursor: string | null;
}

/** Chip counts and the total for the current search / office / chip. */
export interface V2ClientFacets {
  readonly total: number;
  readonly filter: Readonly<Record<V2ClientFilter, number>>;
}
