# CRM redesign context

## Product direction

KOLSS CRM is moving from passive status fields toward explicit, typed workflows. A UI control
should launch a business action, collect any data required by that action, then update the visible
CRM state. The first proof of concept is a radial action dialog for recording the result of a call.

Source conversation: <https://chatgpt.com/s/t_6a5951892a8c8191b91fc81809226ba3>

## Architectural principles

- Treat the radial control as a command launcher, not as a custom form input.
- Describe commands through typed configuration: identifier, label, icon, visual tone, resulting
  status, and whether additional data is required.
- Keep radial geometry independent from command identifiers. Button centers and the visible orbit
  share one computed radius; array order determines angular order.
- Keep icon and semantic tone on each action, while the layout config chooses whether buttons use
  the default white `plain` appearance or their colored `tone` appearance.
- Keep the radial dialog presentation-only. It displays available actions and returns a selected
  command; it does not know about leads, APIs, or stores.
- Let a container or facade orchestrate follow-up dialogs, mutations, and state updates.
- Use Angular signals for local reactive state and Signal Forms for newly introduced forms.
- Keep history records and active tasks as separate domain concepts when the POC moves into the
  production CRM.

Target production flow:

```text
typed action config -> radial UI -> workflow facade -> dialog/API/store -> reactive CRM UI
```

## Proof of concept 01: Call radial menu

Location: `/design/radial-menu`

The page uses one in-memory mock lead. No API, Supabase, local storage, or real CRM record is
involved. Reloading the page resets the state.

Actions:

| Action         | Result                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Успішний       | Opens a required comment dialog; saving sets the status to `Успішний` and displays the comment. |
| Не дозвонилися | Immediately sets the mock lead status to `Не дозвонилися`.                                      |
| Передзвонити   | Immediately sets the mock lead status to `Передзвонити`.                                        |

The radial dialog is dismissible with its central close button, Escape, or the backdrop. Dismissal
never mutates the mock lead. The mock card includes Reset so every branch can be tested repeatedly.

The design page also includes five-action and seven-action launchers. Their additional CRM-shaped
commands only demonstrate the generic selection contract and update local demo labels. On narrow
viewports, action sets larger than three switch from the radial layout to a vertical list.

## POC boundaries

- The page container temporarily owns orchestration because this POC has no backend or shared CRM
  store. The flow is structured so it can be moved into a `CallActionFacade` without changing the
  radial UI.
- The experiment reuses the existing KOLSS design tokens, icon component, buttons, form controls,
  and Material dialog wrapper.
- Existing CRM lead behavior remains untouched.

## Session log

### 2026-07-16 — planned

- Agreed on a separate design-lab route and shared design header navigation.
- Selected a mock lead card as the only persistent visual result; no event journal.
- Made the success comment mandatory.
- Enabled close button, Escape, and backdrop dismissal.
- Chosen icons: `phone_in_talk`, `check_circle`, `phone_missed`, `schedule`, and `close`.

### 2026-07-16 — implemented

- Added the lazy `/design/radial-menu` route and a shared design header with active Catalog/Radial
  Menu navigation.
- Implemented `CallOutcome`, `CallAction`, and `MockLeadState` contracts plus an immutable
  `CALL_ACTIONS` configuration.
- Kept the radial action dialog presentation-only. The page container owns one RxJS workflow that
  resolves the selected outcome, conditionally opens the comment dialog, and applies a result to
  local signal state.
- Added the Signal Form comment flow, three outcome icons, responsive radial geometry, backdrop
  blur, focus trapping, Escape/backdrop dismissal, and reduced-motion support.
- Added focused route/navigation, interaction, and axe accessibility tests.

Verification:

- Focused Vitest: 6/6 passed.
- Application and spec TypeScript checks: passed.
- Targeted ESLint and Prettier checks: passed.
- Production build: passed; existing bundle/component budget warnings do not reference the radial
  menu.
- Browser: desktop and 360 px layouts passed; success flow updated the status/comment; no runtime
  warnings or errors.

Known repository-wide baseline failures outside this POC:

- `npm run check` stops because the generated API client is stale relative to the backend OpenAPI
  schema.
- Full lint reports `consistent-type-definitions` in the already modified lead preferences file.
- Full tests report 22 failures in already modified lead preference/page specs because Node 25 was
  started with an invalid local-storage file; the other 137 tests pass.
- Whole-repository Prettier check lists existing formatting drift in 49 unrelated files.

### 2026-07-17 — compact radial layout

- Applied the browser-tuned desktop radial grid dimensions: `30rem` wide by `23rem` high.
- Preserved the existing narrow-screen media-query geometry.
- Focused radial-menu tests: 5/5 passed; targeted Prettier check and production build passed.
- The production build still reports only the existing application and unrelated CRM component
  budget warnings.

### 2026-07-17 — scalable radial geometry

- Introduced a reusable `RadialAction` contract and separated it from call-specific workflow data.
- Added `RadialLayoutConfig` overrides for radius, start angle, direction, and grid dimensions.
- Replaced outcome-specific CSS positions with polar coordinates. The automatic radius uses action
  count and chord spacing; the three-action call layout keeps its tuned `30rem × 23rem` grid and
  `12rem` radius.
- Added five-action and seven-action launcher cards with local selection results and CRM-style demo
  commands.
- Added the responsive vertical-list presentation for action sets larger than three at narrow or
  short viewports.

Verification:

- Focused Vitest: 12/12 passed across geometry, dialog, page workflow, and axe coverage.
- Application/spec TypeScript checks, targeted ESLint, and Prettier checks passed.
- Production build passed. The radial component no longer adds a component-style budget warning;
  the remaining warnings are the existing initial bundle and unrelated CRM component budgets.
- Browser: 3/5/7 desktop layouts passed; measured button-center distances matched each orbit,
  five/seven actions had no overlaps, the seven-action selection updated only its demo card, and
  the 360 px list mode rendered all actions inside its panel. Runtime console had no warnings or
  errors.

### 2026-07-17 — configurable button appearance

- Added `buttonAppearance: 'plain' | 'tone'` to `RadialLayoutConfig`; omitted configuration defaults
  to white `plain` buttons.
- Kept each action icon and semantic tone in `RadialAction` configuration.
- Added a three-action white-button launcher example while preserving explicit colored call, five,
  and seven-action examples.
- No tests were added or run for this small presentation option by request; TypeScript and the
  production build passed.

Next architectural step: move the page-owned workflow into a `CallActionFacade` when the first real
CRM integration introduces API mutations, call history, and active follow-up tasks.
