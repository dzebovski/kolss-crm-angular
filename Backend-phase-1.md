# Backend Phase 1 — що вже зроблено

**Для агента, який кодить UI (Фаза 2+).**  
Цей документ фіксує інфраструктуру, яку **не треба створювати повторно**. Будуй CRM-екрани поверх існуючого шару.

Детальніше про інтеграцію: [`docs/FRONTEND-INTEGRATION.md`](docs/FRONTEND-INTEGRATION.md)  
Специфікація UI-прототипу: [`crm-interface-prototype-task.md`](crm-interface-prototype-task.md)

---

## Коротко

| Статус | Що |
|--------|-----|
| **Готово — не чіпати** | Auth, Supabase client, guards, routing, login, CRM shell, моделі, ролі |
| **Placeholder — замінити контентом** | `dashboard-page`, `leads-page`, `reports-page`, `accounts-page` |
| **Ще не існує — створити у UI-фазі** | Мок-дані лідів, картка ліда, складені CRM-патерни, locale switcher |
| **Не твоя зона** | Edge Functions, Meta webhook, service role, server-side lead ingestion |

---

## 1. Не створюй повторно

### Auth і сесія

| Файл | Що робить |
|------|-----------|
| `src/app/core/auth/auth.service.ts` | `signIn`, `signOut`, сесія Supabase, профіль з `profiles` |
| `src/app/core/session/session.service.ts` | Офіси користувача, `officeContext`, view-as |
| `src/app/core/auth/auth.guard.ts` | `authGuard`, `guestGuard` |
| `src/app/core/auth/role.guard.ts` | `superAdminGuard` |
| `src/app/features/auth/login/login-page.ts` | Екран `/login` |

**Не додавай:** окремий login, auth interceptor, NgRx auth store, власний JWT, `HttpClient` для auth.

**Використовуй:**

```typescript
import { inject } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { SessionService } from '../core/session/session.service';

const auth = inject(AuthService);
const session = inject(SessionService);

auth.profile();           // Profile | null
auth.sessionContext();    // { user, profile } | null
session.officeContext();  // офіси для фільтра
```

### Supabase

| Файл | Що робить |
|------|-----------|
| `src/app/core/supabase/supabase.service.ts` | Єдиний browser-клієнт |
| `src/environments/environment*.ts` | `supabaseUrl`, `supabaseAnonKey` |

**Не додавай:** другий Supabase client, `@supabase/ssr`, `service_role` key, окремий API layer для CRUD на цій фазі.

**Для моків (Фаза 2):** Supabase **не викликай** — дані локальні.  
**Для реальних даних (Фаза 3):** `injectSupabase()` з `supabase.service.ts`.

### Routing

Маршрути вже в `src/app/app.routes.ts`:

```
/              → redirect (login або /crm/dashboard)
/login         → guestGuard
/design        → без auth
/crm           → authGuard + CrmShell
  /crm/dashboard
  /crm/leads
  /crm/reports
  /crm/accounts  → + superAdminGuard
```

**Не додавай:** паралельні `/app/*` маршрути (це Next.js CRM), новий root layout, дубль shell.

**Нові сторінки** — дочірні до `/crm` або lazy route поруч, напр.:

```
/crm/leads/:leadId   ← ще не створено, додай у app.routes.ts
```

### CRM shell

`src/app/features/crm/shell/crm-shell.ts` — header, nav, user block, `<router-outlet>`.

**Не створюй** другий app shell.  
**Можна розширити** shell (office switcher, locale switcher) — додай у **існуючий** `crm-shell.ts`, не дублюй.

### Моделі і ролі

| Файл | Зміст |
|------|-------|
| `src/app/models/database.ts` | `Profile`, `Office`, `Lead`, `Project`, … |
| `src/app/core/roles/roles.ts` | `canManageUsers`, `hasOfficeLeadFilter`, `roleLabel` |

**Не вигадуй** власні типи ролей (`manager`, `office_head`) — у БД: `super_admin`, `curator`, `office_admin`, `office_member`.

### Bootstrap

`src/app/app.config.ts`:

- `provideRouter(routes)`
- `provideAppInitializer(() => inject(AuthService).initialize())`

**Не додавай** повторну ініціалізацію auth в кожному компоненті.

---

## 2. Що вже є, але порожнє (твоя робота)

Ці файли — **placeholder**. Заміни template і логіку, **не створюй нові маршрути** без потреби:

| Файл | Маршрут | Задача UI-фази |
|------|---------|----------------|
| `src/app/features/crm/dashboard/dashboard-page.ts` | `/crm/dashboard` | Метрики, огляд |
| `src/app/features/crm/leads/leads-page.ts` | `/crm/leads` | Таблиця лідів, групування рік/місяць |
| — | `/crm/leads/:leadId` | **Створити** `lead-detail-page.ts` + route |
| `src/app/features/crm/reports/reports-page.ts` | `/crm/reports` | Воронка, звіти |
| `src/app/features/crm/accounts/accounts-page.ts` | `/crm/accounts` | Список користувачів (мок) |

---

## 3. UI kit — використовуй, не дублюй

Готові компоненти: `src/app/ui/` (експорт у `src/app/ui/index.ts`).

| Компонент | Для чого |
|-----------|----------|
| `UiDataTable` | Таблиця лідів |
| `UiButton`, `UiIconButton` | Дії |
| `UiTextField`, `UiSelect`, `UiTextarea` | Форми |
| `UiTabs` | Вкладки картки ліда |
| `UiBadge`, `UiChip` | Статуси |
| `UiAlert` | Помилки / інфо |
| `UiDialogService` | Confirm |
| `UiPagination` | Пагінація |

Стилі: токени `--ui-*` з `src/styles.scss`.  
Референс: сторінка `/design`.

**Не додавай:** Tailwind, Material компоненти напряму (окрім dialog/tooltip wrapper), нову UI-бібліотеку.

---

## 4. Фаза 2 (UI) — що робити

За [`crm-interface-prototype-task.md`](crm-interface-prototype-task.md):

### Роби

1. **Мок-сервіс** — `src/app/services/leads-mock.service.ts` + `leads-mock.data.ts`
2. **Таблиця лідів** — у `leads-page.ts`, дані з мок-сервісу, signals
3. **Картка ліда** — новий `lead-detail-page.ts`, локальний UI-стан
4. **Складені патерни** — page header, funnel, timeline, workflow panel (поверх `ui/*`)
5. **Locale switcher** у shell — видимий UK/PL/EN, без `@angular/localize`
6. **Office filter** у shell — якщо `session.officeContext()?.canUseOfficeFilter`

### Не роби на Фазі 2

- Підключення Supabase для лідів
- Edge Functions / webhooks
- Реальне збереження коментарів, візитів, статусів
- Mobile/tablet
- Chart-бібліотека (простіші візуалізації CSS/HTML достатньо)

---

## 5. Дані для моків

Мінімальні поля рядка таблиці лідів:

```typescript
interface LeadListItem {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  lead_status: 'new' | 'in_progress' | 'converted' | 'failed';
  workflow_status: string;
  office_code: 'kyiv' | 'warsaw';
  office_name: string;
  assigned_to_name: string | null;
  source_created_at: string;  // ISO — для групування рік/місяць
  last_comment: string | null;
  callback_due_at: string | null;
}
```

Офіси:

- `kyiv` — Київ
- `warsaw` — Варшава

Групування таблиці: **рік → місяць → рядки**.  
Пошук: телефон, імʼя, дата.

---

## 6. Конвенції проєкту

Дотримуйся `best-practices.md` і `.cursor/rules/`:

- Standalone components (без `standalone: true`)
- `input()` / `output()` / `signal()` / `computed()`
- Native control flow: `@if`, `@for`, `@switch`
- Signal Forms для нових форм
- Без `ngClass`, `ngStyle`
- Lazy routes для feature pages
- `@Injectable({ providedIn: 'root' })` для сервісів

---

## 7. Структура папок (орієнтир)

```
src/app/
├── core/           ← НЕ чіпати без узгодження
│   ├── auth/
│   ├── session/
│   ├── supabase/
│   ├── roles/
│   └── navigation/
├── models/         ← розширюй типи за потреби
├── services/       ← ТУТ моки та domain services
├── features/
│   ├── auth/login/ ← готово
│   └── crm/        ← ТУТ основна UI-робота
│       ├── shell/
│       ├── dashboard/
│       ├── leads/
│       ├── reports/
│       └── accounts/
└── ui/             ← primitives, не CRM-логіка
```

---

## 8. Зовнішній бекенд (контекст, не імплементуй)

Production Supabase вже використовується Next.js CRM (`kolss-crm`):

- Таблиці: `leads`, `profiles`, `offices`, `projects`, …
- RLS фільтрує по офісу
- Імпорт лідів: Google Apps Script → webhook (буде Edge Function)

UI-агент **не налаштовує** Supabase Dashboard і **не пише** Edge Functions.

---

## 9. Чеклист перед PR (UI)

- [ ] Не дубльовано auth, supabase client, guards, login, shell
- [ ] Використано `src/app/ui/*` і `--ui-*` токени
- [ ] Мок-дані в `services/`, не захардкоджені в template
- [ ] Нові маршрути — дочірні `/crm/*`
- [ ] `npm run check` проходить
- [ ] Desktop 1280px+, українська за замовчуванням

---

## 10. Корисні посилання в репо

| Документ | Зміст |
|----------|-------|
| [`docs/FRONTEND-INTEGRATION.md`](docs/FRONTEND-INTEGRATION.md) | API точки, Supabase queries, env |
| [`crm-interface-prototype-task.md`](crm-interface-prototype-task.md) | Повна UI-специфікація |
| [`crm-process-ideas.md`](crm-process-ideas.md) | Бізнес-процеси, ролі (концептуально) |
| [`kolss-crm/PROJECT.md`](../kolss-crm/PROJECT.md) | Реальна бізнес-логіка воронок (джерело) |
