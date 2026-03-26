---
name: workers-vite
description: Scaffold a full-stack React SPA on Cloudflare Workers with Hono, TanStack Router, TanStack Query, Drizzle ORM, Tailwind CSS v4, Biome, and Vite. Includes Google OAuth, API token auth, MCP server with OAuth, and mise task runner with bun.
---

# Cloudflare Workers + Vite

## Overview

Build an opinionated full-stack SPA: Hono on Cloudflare Workers owns the API, auth, and MCP server; Vite + React owns the UI. D1 (SQLite) is the database, managed via Drizzle ORM. Bun is the package manager, mise is the task runner.

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)
- **ORM:** Drizzle ORM
- **Server framework:** Hono
- **Client framework:** React 19
- **Routing:** TanStack Router (file-based)
- **Data fetching:** TanStack React Query
- **Styling:** Tailwind CSS v4
- **Linting/formatting:** Biome
- **Build tool:** Vite
- **Schema validation:** Zod
- **MCP:** `@modelcontextprotocol/sdk`
- **Package manager:** Bun
- **Task runner:** mise

## Workflow

1. Bootstrap the project.
   - Run `scripts/bootstrap.sh <app-name> [app-title] [token-prefix]` from an empty directory (or one with only `.git` and mise files).
   - The script copies the bundled template from `assets/template/`, substitutes placeholders (`__APP_NAME__`, `__APP_TITLE__`, `__TOKEN_PREFIX__`, `__COMPAT_DATE__`), installs dependencies at latest versions, creates a D1 database, generates the initial migration, and applies it locally.
   - The resulting project has Google OAuth, API token auth, a stub home page, and is ready to `mise run dev`.
2. Configure Google OAuth.
   - Create `.dev.vars` with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
   - Set the same values in the Cloudflare dashboard for production.
3. Ask the user about color scheme.
   - The template ships with a neutral default. Before the user starts building UI, ask what palette they prefer (warm neutral, cool gray, high contrast, or custom) and update `src/client/app.css`.
   - See `references/client.md` for the color scheme pattern and variable naming convention.
4. Add domain-specific schema.
   - Add tables to `src/server/db/schema.ts` (the auth tables are already there).
   - Derive shared types in `src/shared/types.ts`.
   - Run `mise run db:generate` then `mise run db:migrate local`.
   - See `references/database.md` for schema conventions and query patterns.
5. Add domain routes and MCP tools.
   - Create Hono route modules in `src/server/` and mount them in `index.ts`.
   - Add MCP tools if needed — see `references/mcp.md` for the pattern.
   - See `references/server.md` for the Hono app type pattern.
6. Build the UI.
   - Add routes in `src/client/routes/`.
   - Add React Query hooks in `src/client/lib/api.ts`.
   - See `references/client.md` for routing conventions and the API layer pattern.
7. Validate end to end.
   - `mise run dev` — local dev server.
   - `mise run check` — lint + type check.
   - `mise run build` — check + build.
   - `mise run deploy` — build + deploy.

## References

- Read `references/config-files.md` for all configuration files.
- Read `references/database.md` for Drizzle schema, db helper, shared types, and migration workflow.
- Read `references/server.md` for the Hono worker entry and SPA fallback.
- Read `references/auth.md` for Google OAuth, auth middleware, API tokens, and token utilities.
- Read `references/mcp.md` for the MCP server and MCP OAuth implementation.
- Read `references/client.md` for the React client setup.

## Rules

- Use bun, not npm. Use bunx, not npx. Tasks live in `mise.toml`, not `package.json` scripts.
- Vite plugin order: TanStack Router first, then React, Tailwind, Cloudflare.
- Drizzle schema is the single source of truth for table definitions. Derive TypeScript types from it.
- Generate migrations with `drizzle-kit generate`, apply with `wrangler d1 migrations apply`.
- Use `$defaultFn(() => new Date().toISOString())` for timestamp columns, not SQL `DEFAULT` expressions.
- Use `.returning()` to check affected rows on updates/deletes instead of driver-specific properties.
- Use `sql` template literals from `drizzle-orm` for SQLite functions like `datetime('now')`.
- Store token secrets as SHA-256 hashes. Return full tokens only once on creation.
- Use soft deletes (`revokedAt`/`archivedAt`) with periodic cleanup via scheduled handler.
- SPA fallback must only rewrite paths without file extensions to `index.html`.
- Keep `routeTree.gen.ts` and `migrations/meta/` excluded from Biome and marked as generated in `.gitattributes`.
- Do not use LiveView or SSR. This is a client-rendered SPA.
