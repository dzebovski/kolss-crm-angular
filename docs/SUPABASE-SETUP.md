# KOLSS CRM — Supabase Setup (Phase 4)

Покрокова інструкція для Edge Functions, secrets і cutover з Next.js webhooks.

**Проєкт:** `fpqolqiivzokwpmymqsr` (`kolss-crm`)  
**Edge Functions код:** `kolss-crm-angular/supabase/functions/`  
**DB міграції:** `kolss-crm/supabase/migrations/` (не дублювати)

---

## 1. Angular environment

Dashboard → **Project Settings** → **API**:

| Dashboard           | Angular `environment.ts` |
| ------------------- | ------------------------ |
| Project URL         | `supabaseUrl`            |
| `anon` `public` key | `supabaseAnonKey`        |

**Ніколи** не додавати `service_role` key у Angular.

Локально: `.env.local` → `scripts/sync-env-local.mjs` → `environment.local.ts`.

---

## 2. Auth redirect URLs

Dashboard → **Authentication** → **URL Configuration**:

```
http://localhost:4200/**
https://your-angular-domain.com/**
```

| Поле          | Значення               |
| ------------- | ---------------------- |
| Site URL      | production Angular URL |
| Redirect URLs | localhost + prod       |

Self-registration — **вимкнути**. Користувачів створює `super_admin`.

---

## 3. Edge Functions secrets

Dashboard → **Edge Functions** → **Manage secrets**:

| Secret                              | Призначення                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`         | Admin client у functions (auto-injected, але перевірити)                                    |
| `SUPABASE_URL`                      | DB connection                                                                               |
| `SUPABASE_ANON_KEY`                 | JWT verification у `admin-users`                                                            |
| `IMPORT_WEBHOOK_SECRET`             | Auth webhook від Apps Script                                                                |
| `TELEGRAM_BOT_TOKEN_KYIV`           | Сповіщення Київ                                                                             |
| `TELEGRAM_CHAT_ID_KYIV`             | Сповіщення Київ                                                                             |
| `TELEGRAM_ADDITIONAL_CHAT_IDS_KYIV` | `-1002833157899` — додаткова група Kolss Kyiv; значення через кому підтримують кілька чатів |
| `TELEGRAM_BOT_TOKEN_WARSAW`         | Сповіщення Варшава                                                                          |
| `TELEGRAM_CHAT_ID_WARSAW`           | Сповіщення Варшава                                                                          |
| `SLACK_WEBHOOK_URL_KYIV`            | Optional                                                                                    |
| `SLACK_WEBHOOK_URL_WARSAW`          | Optional                                                                                    |
| `SITE_URL_PUBLIC`                   | `https://crm.kolss.eu` — базовий домен для посилань у Telegram/Slack, без `/crm/leads/:id`  |
| `IMPORT_INCLUDE_TEST_LEADS`         | Optional, `true` для тестових лідів                                                         |

---

## 4. Deploy Edge Functions

```bash
cd kolss-crm-angular

npx supabase login
npx supabase link --project-ref fpqolqiivzokwpmymqsr

npx supabase functions deploy import-lead --no-verify-jwt
npx supabase functions deploy site-lead --no-verify-jwt
npx supabase functions deploy process-notifications --no-verify-jwt
npx supabase functions deploy admin-users
```

| Function                | JWT                  | Auth                    |
| ----------------------- | -------------------- | ----------------------- |
| `import-lead`           | `--no-verify-jwt`    | `IMPORT_WEBHOOK_SECRET` |
| `site-lead`             | `--no-verify-jwt`    | `IMPORT_WEBHOOK_SECRET` |
| `process-notifications` | `--no-verify-jwt`    | `IMPORT_WEBHOOK_SECRET` |
| `admin-users`           | default (verify JWT) | `super_admin` role      |

URLs:

```
https://fpqolqiivzokwpmymqsr.supabase.co/functions/v1/import-lead
https://fpqolqiivzokwpmymqsr.supabase.co/functions/v1/site-lead
https://fpqolqiivzokwpmymqsr.supabase.co/functions/v1/process-notifications
https://fpqolqiivzokwpmymqsr.supabase.co/functions/v1/admin-users
```

---

## 5. Smoke tests

### import-lead

```bash
# Отримати SOURCE_ID:
# SELECT id FROM lead_import_sources JOIN offices ON offices.id = lead_import_sources.office_id WHERE offices.code = 'kyiv';

curl -X POST "https://fpqolqiivzokwpmymqsr.supabase.co/functions/v1/import-lead" \
  -H "Authorization: Bearer $IMPORT_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"source_id":"<uuid>","rows":[{"id":"l:test-edge-001","phone_number":"p:+380501234567","full_name":"Edge Test"}]}'
```

Очікувана відповідь: `{ "ok": true, "rowsCreated": 1, ... }`

### process-notifications

```bash
curl -X POST "https://fpqolqiivzokwpmymqsr.supabase.co/functions/v1/process-notifications" \
  -H "Authorization: Bearer $IMPORT_WEBHOOK_SECRET"
```

### admin-users (потрібен JWT super_admin)

```bash
curl -X POST "https://fpqolqiivzokwpmymqsr.supabase.co/functions/v1/admin-users" \
  -H "Authorization: Bearer $SUPABASE_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"list"}'
```

---

## 6. Import sources (Kyiv + Warsaw)

```sql
SELECT lis.id, lis.name, lis.spreadsheet_id, lis.column_map, o.code
FROM lead_import_sources lis
JOIN offices o ON o.id = lis.office_id
WHERE o.code IN ('kyiv', 'warsaw');
```

Перевірити:

- `spreadsheet_id` заповнений
- `is_enabled = true`
- `id` = `SOURCE_ID` у Apps Script

### Warsaw `column_map`

Якщо польські Meta-форми мають інші заголовки колонок, оновити `column_map`:

```sql
-- Приклад (замінити на реальні заголовки з Google Sheet):
UPDATE lead_import_sources
SET column_map = '{
  "product_interest": "co_chcesz_zamowic?",
  "project_stage_source": "na_jakim_etapie_jest_projekt?"
}'::jsonb
WHERE office_id = (SELECT id FROM offices WHERE code = 'warsaw');
```

Discovery: відкрити Warsaw Google Sheet → перший рядок (headers) → зіставити з ключами:
`product_interest`, `project_stage_source`, `full_name`, `phone_number`, `email`, `id`, `created_time`.

Стандартні Meta-колонки (`id`, `phone_number`, `full_name`) однакові для всіх офісів.

---

## 7. Google Apps Script cutover

У **кожній** таблиці (Kyiv + Warsaw) → Extensions → Apps Script → Script properties:

| Property                | Нове значення                                                       |
| ----------------------- | ------------------------------------------------------------------- |
| `CRM_WEBHOOK_URL`       | `https://fpqolqiivzokwpmymqsr.supabase.co/functions/v1/import-lead` |
| `IMPORT_WEBHOOK_SECRET` | без змін                                                            |
| `SOURCE_ID`             | без змін (UUID з `lead_import_sources`)                             |

**Blue-green:** спочатку протестувати Edge Function curl-ом, потім перемкнути Apps Script. Next.js webhook вимкнути лише після підтвердження імпорту.

Перевірка: новий рядок у Sheet → лід у `leads` за ~5 хв.

---

## 8. Storage bucket

Перевірити bucket `lead-attachments` (створюється міграцією):

- Public: **off**
- Max size: 5 MB
- MIME: PDF, JPG, PNG, DOCX, XLSX

---

## 9. Перший super_admin

Якщо ще немає:

1. Dashboard → Authentication → Users → Add user
2. SQL Editor:

```sql
UPDATE profiles SET role = 'super_admin', is_active = true
WHERE id = '<user-uuid>';
```

---

## 10. Cutover checklist

- [ ] Edge Functions задеплоєні
- [ ] Secrets заповнені
- [ ] Smoke test `import-lead` пройшов
- [ ] Warsaw `column_map` налаштований (якщо потрібно)
- [ ] Apps Script `CRM_WEBHOOK_URL` оновлено (Kyiv + Warsaw)
- [ ] Тестовий імпорт з Google Sheet
- [ ] Angular Auth redirect URLs додані
- [ ] `SITE_URL_PUBLIC` вказує на Angular CRM
- [ ] Next.js webhook endpoint вимкнено

---

## 11. Scheduler (optional)

`process-notifications` викликається inline після `import-lead` і `site-lead`. Для retry failed notifications можна налаштувати:

- Supabase pg_cron
- External cron (curl кожні 5 хв)
- GitHub Actions scheduled workflow

```bash
curl -X POST "https://fpqolqiivzokwpmymqsr.supabase.co/functions/v1/process-notifications" \
  -H "Authorization: Bearer $IMPORT_WEBHOOK_SECRET"
```
