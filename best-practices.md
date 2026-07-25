You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Prefer inline templates for small components; once a template or stylesheet grows past ~80 lines, move it to its own `.html`/`.scss` file
- When using external templates/styles, use paths relative to the component TS file (`./x.html`, never absolute or alias paths)
- Keep a component's TypeScript file within ~300 lines; beyond that, split out a sub-component or a presenter instead of growing the class further
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Read route parameters via `withComponentInputBinding()` and `input()`, not `route.snapshot`

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.
- Global CSS (`styles.scss`) is only for what renders outside the component tree (e.g. CDK overlay panes); every other style belongs on its owning component

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection
- Distinguish API errors by `KolssApiError.status`/`.code`, never by matching on the error message text

## Architecture Boundaries

- No string literals for roles or office codes outside `@core/roles` and `@core/office`; permission decisions go through `@core/policy` — capability comes from the server's `permissions` in `/v1/me`, never re-derived from role on the client
- Domain types and rules live in `@domain/*`; test fixtures live only in `@testing/*` and production code must not import them

## Testing (Vitest + jsdom)

- Use `TestBed.configureTestingModule` with `imports: [ComponentUnderTest]` for standalone components
- Call `await fixture.whenStable()` before asserting on async/signal-driven DOM updates
- Prefer testing behavior and rendered output over implementation details
- Use `fixture.nativeElement` or `fixture.debugElement` for DOM assertions
- Keep tests focused — one behavior per `it()` block
- Run tests with `npm test`
