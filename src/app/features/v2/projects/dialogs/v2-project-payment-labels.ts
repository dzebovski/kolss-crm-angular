import type { MessageKey } from '@core/i18n/messages';
import type { V2ProjectPaymentBasis } from '@domain/v2/project.types';

/** Labels of the payment basis (Add payment, timeline, payments page). */
export const V2_PAYMENT_BASIS_LABEL: Record<V2ProjectPaymentBasis, MessageKey> = {
  receipt: 'v2.projectPopup.payment.basis.receipt',
  invoice: 'v2.projectPopup.payment.basis.invoice',
  contract: 'v2.projectPopup.payment.basis.contract',
  other: 'v2.projectPopup.payment.basis.other',
};
