import type { MessageKey } from '@core/i18n/messages';
import type { V2LeadProduct } from '@domain/v2/lead-card.types';
import type { V2LeadChannel } from '@domain/v2/lead-view.types';

/** Channel names from the design system vocabulary; `other` = old Google Sheet import only. */
export const V2_CHANNEL_LABEL: Record<V2LeadChannel, MessageKey> = {
  referral: 'v2.channel.referral',
  phone: 'v2.channel.phone',
  office: 'v2.channel.office',
  website: 'v2.channel.website',
  meta_ads: 'v2.channel.meta_ads',
  google_ads: 'v2.channel.google_ads',
  other: 'v2.channel.other',
};

/** Product chips (lead card v1.3, `PRODUCTS`). */
export const V2_PRODUCT_LABEL: Record<V2LeadProduct, MessageKey> = {
  kitchen: 'v2.product.kitchen',
  wardrobe: 'v2.product.wardrobe',
  furniture: 'v2.product.furniture',
  bathroom: 'v2.product.bathroom',
  hallway: 'v2.product.hallway',
  other: 'v2.product.other',
};
