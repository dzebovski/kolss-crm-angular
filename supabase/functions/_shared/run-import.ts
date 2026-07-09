import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.1';

import { enqueueLeadNotifications } from './notifications/enqueue.ts';
import { mapLeadRecord, type MappedLeadRow } from './lead-mapper.ts';

export type ImportSource = {
  id: string;
  office_id: string;
  spreadsheet_id: string;
  sheet_name: string;
  column_map: Record<string, unknown> | null;
  is_enabled: boolean;
};

export type ImportSourceWithOffice = ImportSource & {
  offices?: { code: string } | null;
};

export type ImportBatchResult = {
  sourceId: string;
  rowsProcessed: number;
  rowsCreated: number;
  rowsUpdated: number;
  rowsSkipped: number;
};

const EXISTING_LOOKUP_CHUNK = 100;
const UPDATE_CONCURRENCY = 8;

function marketingFieldsFromMapped(mapped: MappedLeadRow) {
  return {
    name: mapped.name,
    phone: mapped.phone,
    email: mapped.email,
    product_interest: mapped.product_interest,
    project_stage_source: mapped.project_stage_source,
    source_created_at: mapped.source_created_at,
    ad_id: mapped.ad_id,
    ad_name: mapped.ad_name,
    campaign_id: mapped.campaign_id,
    campaign_name: mapped.campaign_name,
    form_id: mapped.form_id,
    form_name: mapped.form_name,
    platform: mapped.platform,
    is_organic: mapped.is_organic,
    raw_payload: mapped.raw_payload,
  };
}

async function fetchExistingLeadIds(
  supabase: SupabaseClient,
  sourceSystem: string,
  externalIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < externalIds.length; i += EXISTING_LOOKUP_CHUNK) {
    const chunk = externalIds.slice(i, i + EXISTING_LOOKUP_CHUNK);
    const { data } = await supabase
      .from('leads')
      .select('id, external_lead_id')
      .eq('source_system', sourceSystem)
      .in('external_lead_id', chunk);
    for (const row of data ?? []) {
      map.set(row.external_lead_id, row.id);
    }
  }
  return map;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
}

async function batchUpsertMappedLeads(
  supabase: SupabaseClient,
  source: ImportSourceWithOffice,
  mappedRows: MappedLeadRow[],
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  updateErrors: string[];
}> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const updateErrors: string[] = [];

  const valid = mappedRows.filter((m) => {
    if (m.isTestLead) {
      skipped++;
      return false;
    }
    return true;
  });

  if (valid.length === 0) return { created, updated, skipped, updateErrors };

  const sourceSystem = valid[0].source_system;
  const existingByExternalId = await fetchExistingLeadIds(
    supabase,
    sourceSystem,
    valid.map((m) => m.external_lead_id),
  );

  const toInsert: MappedLeadRow[] = [];
  const toUpdate: { id: string; mapped: MappedLeadRow }[] = [];

  for (const mapped of valid) {
    const existingId = existingByExternalId.get(mapped.external_lead_id);
    if (existingId) {
      toUpdate.push({ id: existingId, mapped });
    } else {
      toInsert.push(mapped);
    }
  }

  for (let i = 0; i < toInsert.length; i += EXISTING_LOOKUP_CHUNK) {
    const chunk = toInsert.slice(i, i + EXISTING_LOOKUP_CHUNK);
    const { data: inserted, error } = await supabase
      .from('leads')
      .insert(
        chunk.map((mapped) => ({
          office_id: source.office_id,
          source_system: mapped.source_system,
          source_channel: mapped.source_system === 'meta_lead_ads' ? 'facebook' : null,
          external_lead_id: mapped.external_lead_id,
          lead_status: 'new',
          workflow_status: 'new',
          workflow_status_changed_at: new Date().toISOString(),
          ...marketingFieldsFromMapped(mapped),
        })),
      )
      .select('id, name, phone, email, product_interest, office_id, source_system');

    if (error) throw error;

    for (const row of inserted ?? []) {
      created++;
      await enqueueLeadNotifications(supabase, row, source.offices ?? null);
    }
  }

  await runWithConcurrency(toUpdate, UPDATE_CONCURRENCY, async ({ id, mapped }) => {
    const { error } = await supabase
      .from('leads')
      .update(marketingFieldsFromMapped(mapped))
      .eq('id', id);
    if (error) {
      updateErrors.push(`lead ${id}: ${error.message}`);
      return;
    }
    updated++;
  });

  return { created, updated, skipped, updateErrors };
}

export async function processWebhookImport(
  supabase: SupabaseClient,
  source: ImportSourceWithOffice,
  rows: Record<string, unknown>[],
): Promise<ImportBatchResult> {
  const { data: run, error: runErr } = await supabase
    .from('lead_import_runs')
    .insert({ source_id: source.id, status: 'running' })
    .select('id')
    .single();

  if (runErr || !run) throw runErr ?? new Error('Failed to create import run');

  const rowsProcessed = rows.length;
  let rowsCreated = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;

  const officeCode = source.offices?.code ?? 'kyiv';

  try {
    const mappedRows = rows.map((row, i) =>
      mapLeadRecord(row, {
        rowNumber: i + 1,
        spreadsheetId: source.spreadsheet_id,
        sheetName: source.sheet_name,
        officeCode,
        columnMap: source.column_map,
      }),
    );

    const batchResult = await batchUpsertMappedLeads(supabase, source, mappedRows);
    rowsCreated = batchResult.created;
    rowsUpdated = batchResult.updated;
    rowsSkipped = batchResult.skipped;

    if (batchResult.updateErrors.length > 0) {
      console.error('[import] lead update failures:', batchResult.updateErrors);
      throw new Error(
        `${batchResult.updateErrors.length} lead update(s) failed; first: ${batchResult.updateErrors[0]}`,
      );
    }

    await supabase
      .from('lead_import_sources')
      .update({ last_imported_at: new Date().toISOString() })
      .eq('id', source.id);

    await supabase
      .from('lead_import_runs')
      .update({
        status: 'success',
        rows_processed: rowsProcessed,
        rows_created: rowsCreated,
        rows_updated: rowsUpdated,
        rows_skipped: rowsSkipped,
        finished_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return {
      sourceId: source.id,
      rowsProcessed,
      rowsCreated,
      rowsUpdated,
      rowsSkipped,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Import failed';
    await supabase
      .from('lead_import_runs')
      .update({
        status: 'failed',
        rows_processed: rowsProcessed,
        rows_created: rowsCreated,
        rows_updated: rowsUpdated,
        rows_skipped: rowsSkipped,
        error_message: message,
        finished_at: new Date().toISOString(),
      })
      .eq('id', run.id);
    throw e;
  }
}
