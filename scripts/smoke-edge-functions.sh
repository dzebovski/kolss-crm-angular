#!/usr/bin/env bash
# Smoke tests for KOLSS CRM Edge Functions (Phase 4).
# Usage:
#   export IMPORT_WEBHOOK_SECRET=... # process-notifications legacy secret
#   export SUPABASE_USER_JWT=...   # super_admin session JWT for admin-users
#   ./scripts/smoke-edge-functions.sh

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-fpqolqiivzokwpmymqsr}"
BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1"

echo "==> process-notifications"
curl -sS -X POST "${BASE_URL}/process-notifications" \
  -H "Authorization: Bearer ${IMPORT_WEBHOOK_SECRET:?IMPORT_WEBHOOK_SECRET required}" \
  -H "Content-Type: application/json" | jq .

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
