import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createAdminClient } from '../_shared/supabase-admin.ts';
import { handleOptions, jsonResponse } from '../_shared/http.ts';
import { processPendingNotifications } from '../_shared/notifications/process.ts';
import { verifyImportWebhookSecret } from '../_shared/webhook-auth.ts';

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!verifyImportWebhookSecret(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = createAdminClient();
    const result = await processPendingNotifications(supabase);
    return jsonResponse({ ok: true, ...result });
  } catch (e) {
    console.error('[process-notifications]', e);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
