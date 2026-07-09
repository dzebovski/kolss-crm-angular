-- Warsaw column_map discovery and update (Phase 4).
-- Run in Supabase SQL Editor after inspecting the Warsaw Google Sheet headers.
-- Canonical migrations: kolss-crm/supabase/migrations/

-- 1. Inspect current import sources
SELECT
  lis.id,
  lis.name,
  lis.spreadsheet_id,
  lis.column_map,
  o.code AS office_code
FROM lead_import_sources lis
JOIN offices o ON o.id = lis.office_id
WHERE o.code IN ('kyiv', 'warsaw');

-- 2. Update Warsaw column_map when Polish Meta form headers are known.
-- Replace placeholder keys with actual sheet header row values.
/*
UPDATE lead_import_sources
SET column_map = jsonb_build_object(
  'product_interest', 'co_chcesz_zamowic?',
  'project_stage_source', 'na_jakim_etapie_jest_projekt?'
)
WHERE office_id = (SELECT id FROM offices WHERE code = 'warsaw');
*/
