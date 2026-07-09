-- Reference migration: allow UPDATE on lead_events for users with office access to the lead.
-- Applied in kolss-crm repo (canonical migrations: kolss-crm/supabase/migrations/).
-- Without this policy, Supabase returns success with 0 updated rows when RLS blocks UPDATE.
-- See kolss-crm/supabase/migrations/20260709120000_lead_events_update_policy.sql for the
-- canonical version with super_admin + user_office_memberships checks.

