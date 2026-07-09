import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.1';

import { getSiteUrlPublic, getSlackWebhookUrl, telegramConfigured } from '../office-env.ts';

type LeadNotificationInput = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  product_interest: string | null;
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
    source_system: lead.source_system,
    office_code: officeCode,
    crm_url: siteUrl ? `${siteUrl}/crm/leads/${lead.id}` : null,
  };

  const channels: ('telegram' | 'slack')[] = [];
  if (telegramConfigured(officeCode)) channels.push('telegram');
  if (getSlackWebhookUrl(officeCode)) channels.push('slack');

  for (const channel of channels) {
    await supabase.from('lead_notifications').upsert(
      {
        lead_id: lead.id,
        channel,
        status: 'pending',
        payload,
        attempts: 0,
        last_error: null,
      },
      { onConflict: 'lead_id,channel', ignoreDuplicates: true },
    );
  }
}
