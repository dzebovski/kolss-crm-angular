import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.1';

import {
  getSiteUrlPublic,
  getSlackWebhookUrl,
  getTelegramChatIds,
  telegramConfigured,
} from '../office-env.ts';

type LeadNotificationInput = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  product_interest: string | null;
  source_note?: string | null;
  order_comment?: string | null;
  office_id: string;
  source_system: string;
};

export async function enqueueLeadNotifications(
  supabase: SupabaseClient,
  lead: LeadNotificationInput,
  offices?: { code: string } | null,
) {
  const officeCode = offices?.code;
  const siteUrl = getSiteUrlPublic();
  const payload = {
    lead_id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    product_interest: lead.product_interest,
    client_info: lead.source_note ?? lead.order_comment ?? null,
    source_system: lead.source_system,
    office_code: officeCode,
    crm_url: siteUrl ? `${siteUrl}/crm/leads/${lead.id}` : null,
  };

  if (telegramConfigured(officeCode)) {
    for (const destination of getTelegramChatIds(officeCode)) {
      await supabase.from('lead_notifications').upsert(
        {
          lead_id: lead.id,
          channel: 'telegram',
          destination,
          status: 'pending',
          payload,
          attempts: 0,
          last_error: null,
        },
        { onConflict: 'lead_id,channel,destination', ignoreDuplicates: true },
      );
    }
  }

  if (getSlackWebhookUrl(officeCode)) {
    await supabase.from('lead_notifications').upsert(
      {
        lead_id: lead.id,
        channel: 'slack',
        destination: '',
        status: 'pending',
        payload,
        attempts: 0,
        last_error: null,
      },
      { onConflict: 'lead_id,channel,destination', ignoreDuplicates: true },
    );
  }
}
