# KOLSS CRM — Agent Brief

## Project

KOLSS CRM Angular frontend application.

## Stack

- **Angular 22** (standalone components, signals, native control flow)
- **TypeScript 6** (strict mode)
- **SCSS** for styles
- **Vitest + jsdom** for unit tests
- **Prettier** for formatting
- **angular-eslint** for linting

## Key Commands

| Command                | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `npm start`            | Dev server (`ng serve`)                  |
| `npm run build`        | Production build                         |
| `npm test`             | Run unit tests (Vitest)                  |
| `npm run lint`         | ESLint (TS + templates)                  |
| `npm run format`       | Auto-format with Prettier                |
| `npm run format:check` | Check formatting without writing         |
| `npm run check`        | Full validation: typecheck + lint + test |

## Project Layout

```
src/
  app/           # Application code (components, services, routes)
  index.html     # Entry HTML
  main.ts        # Bootstrap
  styles.scss    # Global styles
public/          # Static assets
```

## Conventions

Follow [best-practices.md](best-practices.md) for all Angular and TypeScript patterns.
Cursor rules in `.cursor/rules/` enforce these automatically.

## MCP

Angular CLI MCP server is configured in `.cursor/mcp.json`.
Enable it in Cursor Settings → MCP to give the agent live access to Angular docs and tooling.
