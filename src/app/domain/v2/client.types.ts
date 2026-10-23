import type { OfficeId } from '@domain/office.types';
import type { V2LeadProduct } from './lead-card.types';
import type { V2LeadChannel, V2LeadDisplayStatus } from './lead-view.types';
import type { V2Money, V2ProjectStatus } from './project.types';

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

export type V2ClientLanguage = 'pl' | 'uk' | 'en' | 'ru';

/** Contract money of the client's projects, per currency (cancelled projects are left out). */
export interface V2ClientContractValue {
  readonly total: V2Money;
  readonly paid: V2Money;
  readonly remaining: V2Money;
}

export interface V2ClientLeadRow {
  readonly id: string;
  readonly code: string;
  readonly createdAt: string;
  readonly status: V2LeadDisplayStatus;
  readonly products: readonly V2LeadProduct[];
  readonly managerName: string | null;
  /** The lead became this project. */
  readonly projectId: string | null;
}

export interface V2ClientProjectRow {
  readonly id: string;
  /** The code of the lead the project came from. */
  readonly leadCode: string;
  readonly products: readonly V2LeadProduct[];
  readonly status: V2ProjectStatus;
  readonly createdAt: string;
  readonly managerName: string | null;
  readonly contract: {
    readonly total: V2Money;
    /** Whole percent of the total that is paid. */
    readonly percentPaid: number;
  } | null;
}

/** Another client sharing a phone or the email: a merge candidate. */
export interface V2ClientDuplicate extends V2ClientListItem {
  readonly matchedBy: readonly ('phone' | 'email')[];
  readonly email: string | null;
}

/** Client card (`GET /v1/clients/{id}`). */
export interface V2Client extends V2ClientListItem {
  /** Stored phone numbers, compact (`+48601334812`); null when empty. */
  readonly rawPhone: string | null;
  readonly secondPhone: string | null;
  readonly secondPhoneDisplay: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly language: V2ClientLanguage | null;
  readonly about: string | null;
  /** Optimistic-lock counter for `PATCH`. */
  readonly version: number;
  readonly firstChannel: V2LeadChannel | null;
  /** Leads of the client that are not (yet) projects. */
  readonly openLeadsCount: number;
  readonly activeProjectsCount: number;
  readonly contractValue: readonly V2ClientContractValue[];
  readonly leads: readonly V2ClientLeadRow[];
  readonly projects: readonly V2ClientProjectRow[];
  readonly duplicates: readonly V2ClientDuplicate[];
  /** The code the card was opened by when that client was merged into this one. */
  readonly redirectedFromCode: string | null;
  readonly canEdit: boolean;
  readonly canMerge: boolean;
}
