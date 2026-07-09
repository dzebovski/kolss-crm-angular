import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { z } from 'npm:zod@3.24.2';

import { createAdminClient } from '../_shared/supabase-admin.ts';
import { handleOptions, jsonResponse } from '../_shared/http.ts';
import { processWebhookImport } from '../_shared/run-import.ts';
import { processPendingNotifications } from '../_shared/notifications/process.ts';
import { verifyImportWebhookSecret } from '../_shared/webhook-auth.ts';

const bodySchema = z.object({
  source_id: z.string().uuid(),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
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
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      400,
    );
  }

  const { source_id, rows } = parsed.data;

  try {
    const supabase = createAdminClient();
    const { data: source, error: sourceErr } = await supabase
      .from('lead_import_sources')
      .select('*, offices(code)')
      .eq('id', source_id)
      .maybeSingle();

    if (sourceErr) throw sourceErr;
    if (!source) {
      return jsonResponse({ error: 'Import source not found' }, 404);
    }
    if (!source.is_enabled) {
      return jsonResponse({ error: 'Import source is disabled' }, 403);
    }

    const result = await processWebhookImport(supabase, source, rows);
    const notifications = await processPendingNotifications(supabase);
    return jsonResponse({ ok: true, ...result, notifications });
  } catch (e) {
    console.error('[import-lead]', e);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
