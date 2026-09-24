import type { ContractCurrency } from '@domain/lead.types';
import type { OfficeId } from '@domain/office.types';
import type {
  V2LeadChannel,
  V2LeadDisplayStatus,
  V2LeadRating,
  V2LeadStatus,
} from './lead-view.types';

/** Products from the design vocabulary (`leads.products`, OpenAPI `LeadProduct`). */
export type V2LeadProduct = 'kitchen' | 'wardrobe' | 'furniture' | 'bathroom' | 'hallway' | 'other';

/**
 * v2 lead columns (W2–W5) read from the raw `GET /v1/leads/{id}` row. The shared v1 `Lead`
 * model doesn't carry them; every one is optional so the card also works against an API or
 * row that doesn't send them yet.
 */
export interface V2LeadColumns {
  readonly v2Status: V2LeadStatus | null;
  readonly v2StatusChangedAt: string | null;
  readonly rating: V2LeadRating | null;
  readonly channel: V2LeadChannel | null;
  readonly noAnswerAttempts: number;
  readonly estimatedBudgetText: string | null;
  readonly products: readonly V2LeadProduct[];
}

export interface V2LeadBudget {
  /** Free text (`22 000 – 25 000`) or the v1 number grouped by thousands. */
  readonly amount: string;
  readonly currency: ContractCurrency;
}

export interface V2LeadLastUpdate {
  readonly at: string;
  /** Empty when the change has no human author (Meta form, site form, import). */
  readonly actorName: string;
}

/** What the lead card header, meta row and Edit contact info need. Labels are keys (i18n in the UI). */
export interface V2LeadCard {
  readonly id: string;
  /** Optimistic-concurrency token for `PATCH /v1/leads/{id}`. */
  readonly version: number;
  readonly archived: boolean;
  /** `K0418` / `W0142`; empty when the lead has no reference id. */
  readonly code: string;
  readonly name: string;
  readonly initials: string;
  /** Formatted for the lead's office; empty when missing. */
  readonly phone: string;
  /** `tel:` target (digits and `+` only); null without a phone. */
  readonly phoneHref: string | null;
  readonly email: string | null;
  readonly location: string | null;
  readonly budget: V2LeadBudget | null;
  readonly products: readonly V2LeadProduct[];
  /**
   * v1 free-text product (`product_interest`), shown as one tag while `products` is empty:
   * leads from v1 and the Meta form only have this.
   */
  readonly productText: string | null;
  readonly managerId: string | null;
  readonly officeId: OfficeId;
  readonly channel: V2LeadChannel;
  readonly status: V2LeadDisplayStatus;
  /** When the lead became a project (`v2_status_changed_at`); null for any other status. */
  readonly projectAt: string | null;
  readonly rating: V2LeadRating | null;
  readonly createdAt: string;
  readonly lastUpdate: V2LeadLastUpdate;
}
