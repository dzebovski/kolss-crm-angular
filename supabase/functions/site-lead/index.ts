import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { z } from 'npm:zod@3.24.2';

import { createAdminClient } from '../_shared/supabase-admin.ts';
import { handleOptions, jsonResponse } from '../_shared/http.ts';
import { enqueueLeadNotifications } from '../_shared/notifications/enqueue.ts';
import { processPendingNotifications } from '../_shared/notifications/process.ts';
import { verifyImportWebhookSecret } from '../_shared/webhook-auth.ts';

const siteLeadSchema = z.object({
  office_code: z.string().trim().max(32).optional(),
  name: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().max(254).optional(),
  product_interest: z.string().trim().max(64).optional(),
  order_comment: z.string().trim().max(5000).optional(),
  external_id: z.string().trim().max(256).optional(),
});

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!verifyImportWebhookSecret(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const parsed = siteLeadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const data = parsed.data;
  const officeCode = data.office_code || 'kyiv';

  try {
    const admin = createAdminClient();

    const { data: office } = await admin
      .from('offices')
      .select('id, code')
      .eq('code', officeCode)
      .eq('is_active', true)
      .single();

    if (!office) {
      return jsonResponse({ error: 'Office not found' }, 400);
    }

    const externalId = data.external_id || `site:${crypto.randomUUID()}`;

    const { data: existing } = await admin
      .from('leads')
      .select('id')
      .eq('source_system', 'site_form')
      .eq('external_lead_id', externalId)
      .maybeSingle();

    if (existing) {
      return jsonResponse({ ok: true, lead_id: existing.id, duplicate: true });
    }

    const { data: lead, error } = await admin
      .from('leads')
      .insert({
        office_id: office.id,
        source_system: 'site_form',
        external_lead_id: externalId,
        lead_status: 'new',
        workflow_status: 'new',
        workflow_status_changed_at: new Date().toISOString(),
        name: data.name || null,
        phone: data.phone || null,
        email: data.email || null,
        product_interest: data.product_interest || null,
        order_comment: data.order_comment || null,
        raw_payload: data,
      })
      .select('id, name, phone, email, product_interest, order_comment, office_id, source_system')
      .single();

    if (error || !lead) {
      console.error('[site-lead] insert failed', error);
      return jsonResponse({ error: 'Insert failed' }, 500);
    }

    await enqueueLeadNotifications(admin, lead, office);
    await processPendingNotifications(admin);

    return jsonResponse({ ok: true, lead_id: lead.id });
  } catch (e) {
    console.error('[site-lead]', e);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
