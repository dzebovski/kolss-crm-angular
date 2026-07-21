# KOLSS CRM — Supabase Setup

Цей документ описує налаштування Supabase, які ще потрібні Angular CRM. Отримання Meta Lead Ads, створення CRM-лідів і Telegram-сповіщення виконуються Go API `api.kolss.eu`, а не Supabase Edge Function.

**Проєкт:** `fpqolqiivzokwpmymqsr` (`kolss-crm`)

## 1. Angular environment

Dashboard → **Project Settings** → **API**:

| Dashboard | Angular `environment.ts` |
| --- | --- |
| Project URL | `supabaseUrl` |
| `anon` public key | `supabaseAnonKey` |

Ніколи не додавайте `service_role` key, Meta tokens або Telegram tokens у Angular.

Локально: `.env.local` → `scripts/sync-env-local.mjs` → `environment.local.ts`.

## 2. Auth redirect URLs

Dashboard → **Authentication** → **URL Configuration**:

```text
http://localhost:4200/**
https://crm.kolss.eu/**
```

Self-registration має бути вимкнена. Користувачів створює `super_admin`.

## 3. Межа відповідальності

- Angular використовує Supabase Auth і browser-доступ, обмежений RLS.
- Business API та Meta webhook працюють через `https://api.kolss.eu`.
- Meta secrets зберігаються тільки як encrypted secrets DigitalOcean App Platform.
- Історичні `lead_import_sources` та `lead_import_runs` зберігаються для аудиту, але import sources мають бути disabled.
- Legacy `import-lead` Edge Function і Google Apps Script більше не деплояться.

Повне налаштування Meta App, Pages, токенів, webhook та cutover описано в [`../../kolss-platform-api/docs/META-LEAD-ADS-SETUP.md`](../../kolss-platform-api/docs/META-LEAD-ADS-SETUP.md).

## 4. Актуальні Edge Functions

Якщо ці legacy-сумісні функції ще використовуються іншими каналами, їх можна деплоїти окремо від Meta integration:

```bash
npx supabase login
npx supabase link --project-ref fpqolqiivzokwpmymqsr
npx supabase functions deploy site-lead --no-verify-jwt
npx supabase functions deploy process-notifications --no-verify-jwt
npx supabase functions deploy admin-users
```

Не деплоїти видалену `import-lead`.

## 5. Storage bucket

Перевірити bucket `lead-attachments`:

- Public: **off**
- Max size: 5 MB
- MIME: PDF, JPG, PNG, DOCX, XLSX

## 6. Перший super_admin

Якщо ще немає:

1. Dashboard → Authentication → Users → Add user.
2. SQL Editor:

```sql
UPDATE profiles
SET role = 'super_admin', is_active = true
WHERE id = '<user-uuid>';
```

## 7. Перевірка після cutover

```sql
SELECT id, name, is_enabled
FROM lead_import_sources
WHERE is_enabled = true;
```

Запит має повернути нуль рядків. Далі перевірити:

- Angular login і офісні RLS;
- тестовий Meta lead для Kyiv Page і Warsaw Page;
- створення одного CRM lead та одного Telegram notification на кожен `leadgen_id`;
- відсутність викликів `import-lead` у логах Supabase.
