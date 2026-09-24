import type { OfficeId } from '@domain/office.types';

/**
 * CRM v2 lead status (decision D1a): one field that includes the call result.
 * Keys follow the design system `status-*` tokens.
 */
export type V2LeadStatus =
  'new' | 'later' | 'noanswer' | 'success' | 'thinking' | 'invited' | 'lost' | 'project';

/** v1 client statuses v2 only shows read-only as history (decision D1c). */
export type V2LegacyLeadStatus =
  'measurement_scheduled' | 'calculation_in_progress' | 'postponed' | 'contract_signed';

export type V2LeadDisplayStatus = V2LeadStatus | V2LegacyLeadStatus;

/** Rating badge next to the client name (decision D3); stays null until W2 adds the field. */
export type V2LeadRating = 'cold' | 'medium' | 'hot';

/** Channels from the design system vocabulary; W3 adds the real field. */
export type V2LeadChannel = 'referral' | 'phone' | 'office' | 'website' | 'meta_ads' | 'google_ads';

export interface V2LeadLastComment {
  readonly text: string;
  /** ISO timestamp; the age is rendered with the v2 date rules. */
  readonly at: string;
}

/**
 * What a v2 leads-list row needs. Labels are resolved in the UI through i18n:
 * status / rating / channel keys, and the office name via `OFFICE_CONFIG[officeId].nameKey`.
 * `null` values render as "Not set".
 */
export interface V2LeadListItem {
  readonly id: string;
  /** Client code, e.g. `K0418` (Kyiv) / `W0231` (Warsaw), from `reference_id`. */
  readonly code: string;
  readonly name: string;
  /** Phone formatted for the lead's office. */
  readonly phone: string;
  readonly status: V2LeadDisplayStatus;
  readonly rating: V2LeadRating | null;
  readonly channel: V2LeadChannel | null;
  readonly officeId: OfficeId;
  readonly managerId: string | null;
  readonly managerName: string | null;
  /** ISO timestamp the lead arrived; drives the list date column and month groups. */
  readonly createdAt: string;
  readonly lastComment: V2LeadLastComment | null;
}
