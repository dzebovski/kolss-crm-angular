# Historical migration copies — NOT canonical

The `.sql` files in this directory are **historical reference copies**, not the source of truth.

The canonical Supabase migrations for KOLSS live in the sibling repository:

```
../kolss-platform-api/supabase/migrations/
```

Any schema or RLS-policy change must be made there. Do **not** apply, edit, or run the files in
this directory as if they were authoritative — they were copied here at the time they were written
for local reference and can drift from (or already have drifted from) the canonical migrations.

## Verification (2026-07-25)

Compared against `../kolss-platform-api/supabase/migrations/`:

- `20260707_simplified_workflow.sql` — a matching canonical file exists
  (`20260707120000_simplified_workflow.sql`); bodies are identical apart from the header comment.
- `20260709_loss_reasons_crm_codes.sql` — a matching canonical file exists
  (`20260709130000_loss_reasons_crm_codes.sql`); bodies are identical apart from the header
  comment.
- `20260709_lead_events_update_policy.sql`, `20260709_leads_delete_policy.sql`,
  `20260709_leads_insert_policy.sql` — **no canonical file with a matching name currently exists**
  in `kolss-platform-api/supabase/migrations/`. Each file's own header comment points at a specific
  canonical path (e.g. `kolss-crm/supabase/migrations/20260709120000_lead_events_update_policy.sql`)
  that is not present in the current canonical directory listing — the underlying policies may have
  been folded into a later consolidated migration, or the repo referenced (`kolss-crm`, an old name
  for `kolss-platform-api`) predates the current history.

If you need the current state of any of these policies or tables, read
`../kolss-platform-api/supabase/migrations/` directly rather than trusting this directory.
