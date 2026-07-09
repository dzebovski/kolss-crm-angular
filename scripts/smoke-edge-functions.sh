#!/usr/bin/env bash
# Smoke tests for KOLSS CRM Edge Functions (Phase 4).
# Usage:
#   export IMPORT_WEBHOOK_SECRET=...
#   export SUPABASE_USER_JWT=...   # super_admin session JWT for admin-users
#   ./scripts/smoke-edge-functions.sh

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-fpqolqiivzokwpmymqsr}"
BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1"

echo "==> process-notifications"
curl -sS -X POST "${BASE_URL}/process-notifications" \
  -H "Authorization: Bearer ${IMPORT_WEBHOOK_SECRET:?IMPORT_WEBHOOK_SECRET required}" \
  -H "Content-Type: application/json" | jq .

if [[ -n "${IMPORT_SOURCE_ID:-}" ]]; then
  echo "==> import-lead"
  curl -sS -X POST "${BASE_URL}/import-lead" \
    -H "Authorization: Bearer ${IMPORT_WEBHOOK_SECRET}" \
    -H "Content-Type: application/json" \
    -d "{\"source_id\":\"${IMPORT_SOURCE_ID}\",\"rows\":[{\"id\":\"l:smoke-$(date +%s)\",\"phone_number\":\"p:+380501234567\",\"full_name\":\"Smoke Test\"}]}" | jq .
else
  echo "Skipping import-lead (set IMPORT_SOURCE_ID to test)"
fi

if [[ -n "${SUPABASE_USER_JWT:-}" ]]; then
  echo "==> admin-users list"
  curl -sS -X POST "${BASE_URL}/admin-users" \
    -H "Authorization: Bearer ${SUPABASE_USER_JWT}" \
    -H "Content-Type: application/json" \
    -d '{"action":"list"}' | jq .
else
  echo "Skipping admin-users (set SUPABASE_USER_JWT to test)"
fi

echo "Done."
